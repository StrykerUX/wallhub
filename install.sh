#!/usr/bin/env bash
set -euo pipefail

REPO="StrykerUX/wallhub"
VERSION="1.0.0"
BIN_DIR="$HOME/.local/bin"
SHARE_DIR="$HOME/.local/share"
SERVICE_DIR="$HOME/.config/systemd/user"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BOLD}[wallhub]${NC} $*"; }
success() { echo -e "${GREEN}[wallhub]${NC} $*"; }
warn()    { echo -e "${YELLOW}[wallhub]${NC} $*"; }
die()     { echo -e "${RED}[wallhub] ERROR:${NC} $*" >&2; exit 1; }

# ── Detect package manager ───────────────────────────────────────────────────

if command -v pacman &>/dev/null; then
    PM="pacman"
elif command -v apt &>/dev/null; then
    PM="apt"
else
    PM="unknown"
    warn "Unsupported package manager — skipping dependency install."
    warn "Make sure webkit2gtk-4.1 and libappindicator are installed manually."
fi

# ── Install system dependencies ──────────────────────────────────────────────

if [ "$PM" = "pacman" ]; then
    info "Installing system dependencies via pacman..."
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 base-devel curl wget file openssl \
        appmenu-gtk-module libappindicator-gtk3 librsvg
elif [ "$PM" = "apt" ]; then
    info "Installing system dependencies via apt..."
    sudo apt update -q
    sudo apt install -y \
        libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
        curl wget file
fi

# ── Download binaries ────────────────────────────────────────────────────────

BASE_URL="https://github.com/$REPO/releases/download/v$VERSION"

mkdir -p "$BIN_DIR"

info "Downloading wallhub..."
curl -fsSL "$BASE_URL/wallhub" -o "$BIN_DIR/wallhub"
chmod +x "$BIN_DIR/wallhub"

info "Downloading wallhub-daemon..."
curl -fsSL "$BASE_URL/wallhub-daemon" -o "$BIN_DIR/wallhub-daemon"
chmod +x "$BIN_DIR/wallhub-daemon"

# ── Install icons ────────────────────────────────────────────────────────────

for size in 32x32 128x128 256x256; do
    ICON_DIR="$SHARE_DIR/icons/hicolor/$size/apps"
    mkdir -p "$ICON_DIR"
    curl -fsSL "https://raw.githubusercontent.com/$REPO/main/crates/wallhub-gui/src-tauri/icons/icon.png" \
        -o "$ICON_DIR/wallhub.png" 2>/dev/null || true
done

# ── Install .desktop entry ───────────────────────────────────────────────────

mkdir -p "$SHARE_DIR/applications"
cat > "$SHARE_DIR/applications/wallhub.desktop" << EOF
[Desktop Entry]
Name=Wallhub
Comment=Wallpaper manager with wallhaven.cc integration
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 $BIN_DIR/wallhub
Icon=wallhub
Terminal=false
Type=Application
Categories=Graphics;Settings;
StartupWMClass=wallhub
EOF

if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$SHARE_DIR/applications" 2>/dev/null || true
fi

# ── Set up systemd user service ──────────────────────────────────────────────

mkdir -p "$SERVICE_DIR"
cat > "$SERVICE_DIR/wallhub-daemon.service" << EOF
[Unit]
Description=Wallhub rotation daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=$BIN_DIR/wallhub-daemon
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now wallhub-daemon.service

# ── Make sure ~/.local/bin is in PATH ────────────────────────────────────────

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "$BIN_DIR is not in your PATH."
    warn "Add this to your ~/.bashrc or ~/.zshrc or ~/.config/fish/config.fish:"
    echo ""
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
fi

# ── Done ─────────────────────────────────────────────────────────────────────

success "Wallhub v$VERSION installed successfully!"
echo ""
echo -e "  ${BOLD}Launch:${NC}  wallhub  (or find it in your app launcher)"
echo -e "  ${BOLD}Daemon:${NC}  systemctl --user status wallhub-daemon"
echo -e "  ${BOLD}Logs:${NC}    journalctl --user -u wallhub-daemon -f"
echo ""
