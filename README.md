# Wallhub

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Linux%20%2F%20GNOME%20%7C%20KDE-informational)
![Rust](https://img.shields.io/badge/built%20with-Rust%20%2B%20Tauri-orange)

> 🇪🇸 [Versión en español](README.es.md)

A desktop wallpaper manager for Linux (GNOME and KDE Plasma 6) with [wallhaven.cc](https://wallhaven.cc/) integration. Browse and download wallpapers, apply them to your desktop and lock screen, and automate rotation — all without keeping the GUI open.

---

## Features

- **Browse** wallhaven.cc with filters: categories, purity, resolution, ratio, and sorting
- **Apply** wallpapers to desktop, lock screen, or both
  - GNOME: via `gsettings`
  - KDE Plasma 6: via `plasma-apply-wallpaperimage` and `kwriteconfig6`
- **Automatic rotation** in three modes:
  - **Interval** — change every N minutes
  - **Time of day** — different wallpaper for dawn / day / dusk / night (uses local sunrise/sunset times)
  - **Daily download** — fetch a new wallpaper from wallhaven every morning
- **Pool sources** — rotate from your local library, random wallhaven results, or a hand-picked selection
- **Background daemon** via systemd user service — rotation keeps running even when the GUI is closed
- **Library** — browse, apply, and delete your downloaded wallpapers

---

## Architecture

```
wallhub/
├── apps/ui/                     # Next.js 15 frontend (embedded in Tauri window)
├── crates/
│   ├── wallhub-core/            # Shared library: API client, scheduler, storage, IPC
│   ├── wallhub-gui/src-tauri/   # Tauri desktop app (window + Rust commands)
│   └── wallhub-daemon/          # Background rotation daemon (systemd user service)
└── Cargo.toml                   # Cargo workspace
```

The GUI and the daemon are separate binaries. The daemon runs in the background (≈5–10 MB RAM) and handles rotation even when you close the app. They communicate via a Unix socket.

---

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/StrykerUX/wallhub/main/install.sh | bash
```

Installs binaries to `~/.local/bin`, sets up the systemd user service, and adds a desktop entry. Works on Arch/CachyOS and Debian/Ubuntu.

**Arch / CachyOS (via AUR):**

```bash
yay -S wallhub-bin
systemctl --user enable --now wallhub-daemon.service
```

Then launch Wallhub from your app launcher.

---

## Requirements (manual install / development)

| | |
|---|---|
| OS | Linux — GNOME (Wayland/X11) or KDE Plasma 6 (Wayland/X11) |
| Rust | stable toolchain via `rustup` |
| Node.js | 20+ |
| pnpm | 8+ |

### System packages — Arch / CachyOS

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

> KDE users: `plasma-apply-wallpaperimage`, `kwriteconfig6`, and `qdbus6` come pre-installed with `plasma-workspace`. No extra packages needed.

---

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

> `WEBKIT_DISABLE_DMABUF_RENDERER=1` prevents a WebKit crash on some GNOME/Wayland setups. Safe to omit on KDE or X11.

### 5. Set up the background daemon

The daemon handles wallpaper rotation independently of the GUI.

```bash
# Build the daemon (from repo root)
cargo build --bin wallhub-daemon

# Create the systemd user service
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

---

## Production build

```bash
cd crates/wallhub-gui
pnpm tauri build
```

Output bundles (`.deb`, AppImage, `.tar.gz`) land in `target/release/bundle/`.

After a release build, update the daemon service `ExecStart` to `target/release/wallhub-daemon` and restart it:

```bash
systemctl --user daemon-reload && systemctl --user restart wallhub-daemon
```

---

## Configuration

Config is stored at `~/.config/wallhub/config.toml` — created automatically on first run. You generally don't need to edit it by hand; everything is configurable from the app's Settings and Rotation pages.

### wallhaven API key (optional)

An API key unlocks NSFW content and higher rate limits. Add it in **Settings → API Key** — it is saved to `config.toml`.

Get a key at [wallhaven.cc/settings](https://wallhaven.cc/settings).

---

## Troubleshooting

**Wallpaper didn't change on GNOME?** Check via terminal:

```bash
gsettings get org.gnome.desktop.background picture-uri
gsettings get org.gnome.desktop.background picture-uri-dark
gsettings get org.gnome.desktop.screensaver picture-uri
```

**Wallpaper didn't change on KDE?** Verify `plasma-apply-wallpaperimage` is available:

```bash
which plasma-apply-wallpaperimage
```

**Daemon not rotating?** Check logs:

```bash
journalctl --user -u wallhub-daemon -f
```

**Daemon running stale code after a code change?** Rebuild and restart:

```bash
cargo build --bin wallhub-daemon && systemctl --user restart wallhub-daemon
```

---

## License

MIT
