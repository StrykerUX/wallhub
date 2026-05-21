# Wallhub

A GNOME wallpaper manager for CachyOS/Arch Linux with [wallhaven.cc](https://wallhaven.cc/) integration. Browse and download wallpapers, set them on your desktop and lock screen, and automate rotation by time of day, interval, or daily download — all without keeping the GUI open.

## Features

- Browse wallhaven.cc with filters (categories, purity, resolution, ratio)
- Apply wallpapers to desktop, lock screen, or both via `gsettings`
- Three rotation modes: **interval** (every N minutes), **time of day** (dawn/day/dusk/night), **daily download**
- Pool sources: local library, wallhaven random, or a hand-picked selection
- Background daemon with systemd user service — rotates wallpapers without the GUI running
- Library management: view, apply, and delete downloaded wallpapers

## Architecture

```
wallhub/
├── apps/ui/                     # Next.js 15 frontend (runs inside Tauri)
├── crates/
│   ├── wallhub-core/            # Shared library (API client, scheduler, storage, IPC)
│   ├── wallhub-gui/src-tauri/   # Tauri app (commands, window)
│   └── wallhub-daemon/          # Background rotation daemon
└── Cargo.toml                   # Cargo workspace
```

## Requirements

- **OS**: Linux with GNOME (Wayland or X11)
- **Rust**: stable toolchain via `rustup`
- **Node.js**: 20+ with `pnpm`
- **System packages** (Arch/CachyOS):

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

## Installation (development)

### 1. Clone the repo

```bash
git clone git@github.com:StrykerUX/wallhub.git
cd wallhub
```

### 2. Install Rust

```bash
sudo pacman -S --needed rustup
rustup default stable
```

### 3. Install frontend dependencies

```bash
cd apps/ui
pnpm install
cd ../..
```

### 4. Run in development mode

```bash
cd crates/wallhub-gui
WEBKIT_DISABLE_DMABUF_RENDERER=1 pnpm tauri dev
```

> `WEBKIT_DISABLE_DMABUF_RENDERER=1` prevents a crash on some GNOME/Wayland setups with WebKit.

### 5. Build and start the daemon

The daemon handles rotation in the background. Build and start it separately:

```bash
cargo build --bin wallhub-daemon
```

Then set up the systemd user service (one-time):

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/wallhub-daemon.service << 'EOF'
[Unit]
Description=Wallhub rotation daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=%h/wallhub/target/debug/wallhub-daemon
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now wallhub-daemon.service
```

> Update `ExecStart` path to wherever you cloned the repo.

## Production build

```bash
cd crates/wallhub-gui
pnpm tauri build
```

Outputs (`.deb`, AppImage, `.tar.gz`) will be at `target/release/bundle/`.

Update the daemon service's `ExecStart` to point to `target/release/wallhub-daemon` after a release build.

## Configuration

Config is stored at `~/.config/wallhub/config.toml`. It is created automatically on first run.

### wallhaven API key (optional)

Required to access NSFW content. Paste your key in **Settings → API Key** — it is saved in `config.toml`.

Get a key at [wallhaven.cc/settings](https://wallhaven.cc/settings).

## Verifying wallpaper changes

```bash
gsettings get org.gnome.desktop.background picture-uri
gsettings get org.gnome.desktop.background picture-uri-dark
gsettings get org.gnome.desktop.screensaver picture-uri
```

## Daemon logs

```bash
journalctl --user -u wallhub-daemon -f
```

## License

MIT
