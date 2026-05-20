use anyhow::Result;
use std::sync::Arc;
use tracing::info;
use wallhub_core::{
    config::Config,
    ipc::{IpcCommand, IpcServer, IpcStatus},
    scheduler::Scheduler,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("wallhub_daemon=info".parse()?)
                .add_directive("wallhub_core=info".parse()?),
        )
        .init();

    info!("wallhub-daemon starting");
    install_systemd_service()?;

    let config = Config::load()?;
    let scheduler = Arc::new(Scheduler::new(config));

    let ipc_server = IpcServer::bind()?;
    info!("IPC socket ready");

    // Handle SIGTERM for graceful shutdown
    let scheduler_clone = Arc::clone(&scheduler);
    tokio::spawn(async move {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut sig) = signal(SignalKind::terminate()) {
            sig.recv().await;
            info!("SIGTERM received, shutting down");
            scheduler_clone.pause();
            std::process::exit(0);
        }
    });

    // IPC handler
    let sched_ipc = Arc::clone(&scheduler);
    tokio::spawn(async move {
        ipc_server
            .serve(move |cmd| {
                let s = Arc::clone(&sched_ipc);
                async move { handle_ipc_command(cmd, &s).await }
            })
            .await;
    });

    // Main scheduling loop
    scheduler.run().await;
    Ok(())
}

async fn handle_ipc_command(cmd: IpcCommand, scheduler: &Scheduler) -> IpcStatus {
    match cmd {
        IpcCommand::Status => scheduler.status(),
        IpcCommand::Pause => {
            scheduler.pause();
            scheduler.status()
        }
        IpcCommand::Resume => {
            scheduler.resume();
            scheduler.status()
        }
        IpcCommand::Next => {
            if let Err(e) = scheduler.apply_next().await {
                IpcStatus {
                    ok: false,
                    state: "active".into(),
                    mode: "unknown".into(),
                    next_at: None,
                    error: Some(e.to_string()),
                }
            } else {
                scheduler.status()
            }
        }
        IpcCommand::Reload => {
            match Config::load() {
                Ok(cfg) => {
                    scheduler.reload_config(cfg);
                    scheduler.status()
                }
                Err(e) => IpcStatus {
                    ok: false,
                    state: scheduler.status().state,
                    mode: scheduler.status().mode,
                    next_at: None,
                    error: Some(e.to_string()),
                },
            }
        }
    }
}

fn install_systemd_service() -> Result<()> {
    let service_dir = dirs::config_dir()
        .unwrap_or_default()
        .join("systemd/user");
    let service_path = service_dir.join("wallhub-daemon.service");

    if service_path.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(&service_dir)?;

    let binary = std::env::current_exe()?;
    let unit = format!(
        r#"[Unit]
Description=Wallhub wallpaper rotator
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart={binary}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
"#,
        binary = binary.display()
    );

    std::fs::write(&service_path, unit)?;
    tracing::info!("Wrote systemd unit to {}", service_path.display());

    // Enable and start
    for args in [
        vec!["--user", "daemon-reload"],
        vec!["--user", "enable", "--now", "wallhub-daemon.service"],
    ] {
        let status = std::process::Command::new("systemctl").args(&args).status();
        match status {
            Ok(s) if s.success() => {}
            Ok(s) => tracing::warn!("systemctl {:?} exited with {s}", args),
            Err(e) => tracing::warn!("systemctl {:?} failed: {e}", args),
        }
    }
    Ok(())
}
