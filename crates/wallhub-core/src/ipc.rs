use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};

fn socket_path() -> PathBuf {
    let runtime_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(runtime_dir).join("wallhub.sock")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "cmd")]
pub enum IpcCommand {
    Next,
    Pause,
    Resume,
    Reload,
    Status,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcStatus {
    pub ok: bool,
    pub state: String,
    pub mode: String,
    pub next_at: Option<String>,
    pub error: Option<String>,
}

pub struct IpcServer {
    listener: UnixListener,
}

impl IpcServer {
    pub fn bind() -> Result<Self> {
        let path = socket_path();
        // Remove stale socket
        let _ = std::fs::remove_file(&path);
        let listener = UnixListener::bind(&path)
            .with_context(|| format!("binding Unix socket at {}", path.display()))?;
        Ok(Self { listener })
    }

    /// Accept a single connection, read one JSON command line, call handler,
    /// write JSON response. Loops forever.
    pub async fn serve<F, Fut>(&self, mut handler: F)
    where
        F: FnMut(IpcCommand) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = IpcStatus> + Send,
    {
        loop {
            match self.listener.accept().await {
                Ok((stream, _)) => {
                    if let Err(e) = handle_conn(stream, &mut handler).await {
                        tracing::warn!("IPC connection error: {e}");
                    }
                }
                Err(e) => tracing::error!("IPC accept error: {e}"),
            }
        }
    }
}

async fn handle_conn<F, Fut>(stream: UnixStream, handler: &mut F) -> Result<()>
where
    F: FnMut(IpcCommand) -> Fut,
    Fut: std::future::Future<Output = IpcStatus>,
{
    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);
    let mut line = String::new();
    reader.read_line(&mut line).await?;
    let cmd: IpcCommand = serde_json::from_str(line.trim())?;
    let status = handler(cmd).await;
    let response = serde_json::to_string(&status)? + "\n";
    write_half.write_all(response.as_bytes()).await?;
    Ok(())
}

pub struct IpcClient;

impl IpcClient {
    pub async fn send(cmd: IpcCommand) -> Result<IpcStatus> {
        let stream = UnixStream::connect(socket_path())
            .await
            .context("connecting to wallhub daemon socket")?;
        let (read_half, mut write_half) = stream.into_split();
        let payload = serde_json::to_string(&cmd)? + "\n";
        write_half.write_all(payload.as_bytes()).await?;
        write_half.shutdown().await?;
        let mut reader = BufReader::new(read_half);
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        Ok(serde_json::from_str(line.trim())?)
    }

    pub async fn status() -> Result<IpcStatus> {
        Self::send(IpcCommand::Status).await
    }

    pub async fn next() -> Result<IpcStatus> {
        Self::send(IpcCommand::Next).await
    }

    pub async fn pause() -> Result<IpcStatus> {
        Self::send(IpcCommand::Pause).await
    }

    pub async fn resume() -> Result<IpcStatus> {
        Self::send(IpcCommand::Resume).await
    }

    pub async fn reload() -> Result<IpcStatus> {
        Self::send(IpcCommand::Reload).await
    }
}
