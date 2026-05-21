# Wallhub

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Linux%20%2F%20GNOME-informational)
![Rust](https://img.shields.io/badge/built%20with-Rust%20%2B%20Tauri-orange)

A GNOME wallpaper manager for CachyOS / Arch Linux with [wallhaven.cc](https://wallhaven.cc/) integration.

Browse and download wallpapers, apply them to your desktop and lock screen, and automate rotation by time of day, interval, or daily download — all without keeping the GUI open.

## Features

- **Browse** wallhaven.cc with filters: categories, purity, resolution, ratio, sorting
- **Apply** wallpapers to desktop, lock screen, or both — GNOME via `gsettings`, KDE Plasma 6 via `plasma-apply-wallpaperimage` + `kwriteconfig6`
- **Rotate automatically** in three modes:
  - **Interval** — change every N minutes from your library or wallhaven
  - **Time of day** — different wallpaper for dawn / day / dusk / night
  - **Daily download** — fetch a fresh wallpaper from wallhaven every morning
- **Pool sources** — rotate from your local library, random wallhaven results, or a hand-picked selection
- **Background daemon** via systemd user service — rotation continues even when the GUI is closed
- **Library** — view, apply, and delete downloaded wallpapers

## Architecture

```
wallhub/
├── apps/ui/                     # Next.js 15 frontend (embedded in Tauri)
├── crates/
│   ├── wallhub-core/            # Shared library: API client, scheduler, storage, IPC
│   ├── wallhub-gui/src-tauri/   # Tauri desktop app
│   └── wallhub-daemon/          # Background rotation daemon (systemd user service)
└── Cargo.toml                   # Cargo workspace
```

## Requirements

| Requirement | Version |
|---|---|
| OS | Linux + GNOME or KDE Plasma 6 (Wayland or X11) |
| Rust | stable (via `rustup`) |
| Node.js | 20+ |
| pnpm | 8+ |

Install system dependencies (Arch / CachyOS):

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

## Installation

### 1. Clone

```bash
git clone https://github.com/StrykerUX/wallhub.git
cd wallhub
```

### 2. Install Rust

```bash
sudo pacman -S --needed rustup
rustup default stable
```

### 3. Install frontend dependencies

```bash
cd apps/ui && pnpm install && cd ../..
```

### 4. Run in development mode

```bash
cd crates/wallhub-gui
WEBKIT_DISABLE_DMABUF_RENDERER=1 pnpm tauri dev
```

> `WEBKIT_DISABLE_DMABUF_RENDERER=1` prevents a WebKit crash on some GNOME Wayland setups.

### 5. Set up the daemon

The daemon handles wallpaper rotation in the background. Build it and register the systemd service:

```bash
# From the repo root
cargo build --bin wallhub-daemon

mkdir -p ~/.config/systemd/user
REPO_DIR=$(pwd)

cat > ~/.config/systemd/user/wallhub-daemon.service << EOF
[Unit]
Description=Wallhub rotation daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=${REPO_DIR}/target/debug/wallhub-daemon
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now wallhub-daemon.service
```

Verify it's running:

```bash
systemctl --user status wallhub-daemon
```

## Production build

```bash
cd crates/wallhub-gui
pnpm tauri build
```

Bundles (`.deb`, AppImage, `.tar.gz`) are output to `target/release/bundle/`.

After a release build, update the daemon service `ExecStart` to point to `target/release/wallhub-daemon` and run `systemctl --user daemon-reload && systemctl --user restart wallhub-daemon`.

## Configuration

Config is stored at `~/.config/wallhub/config.toml` and created automatically on first run.

### wallhaven API key (optional)

An API key is required to access NSFW content and higher rate limits. Add it in **Settings → API Key** inside the app — it is saved to `config.toml`.

Get a key at [wallhaven.cc/settings](https://wallhaven.cc/settings).

## Troubleshooting

**Wallpaper didn't change?** Verify via terminal:

```bash
gsettings get org.gnome.desktop.background picture-uri
gsettings get org.gnome.desktop.background picture-uri-dark
gsettings get org.gnome.desktop.screensaver picture-uri
```

**Daemon not rotating?** Check logs:

```bash
journalctl --user -u wallhub-daemon -f
```

**Daemon out of date after a code change?** Rebuild and restart:

```bash
cargo build --bin wallhub-daemon && systemctl --user restart wallhub-daemon
```

## License

MIT
