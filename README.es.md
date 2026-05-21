# Wallhub

![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
![Plataforma](https://img.shields.io/badge/plataforma-Linux%20%2F%20GNOME%20%7C%20KDE-informational)
![Rust](https://img.shields.io/badge/hecho%20con-Rust%20%2B%20Tauri-orange)

> 🇺🇸 [English version](README.md)

Gestor de wallpapers para Linux (GNOME y KDE Plasma 6) con integración a [wallhaven.cc](https://wallhaven.cc/). Explora y descarga wallpapers, aplícalos en tu escritorio y pantalla de bloqueo, y automatiza la rotación — sin necesidad de mantener la interfaz abierta.

---

## Características

- **Explorar** wallhaven.cc con filtros: categorías, pureza, resolución, ratio y ordenamiento
- **Aplicar** wallpapers al escritorio, pantalla de bloqueo, o ambos
  - GNOME: vía `gsettings`
  - KDE Plasma 6: vía `plasma-apply-wallpaperimage` y `kwriteconfig6`
- **Rotación automática** en tres modos:
  - **Intervalo** — cambia cada N minutos
  - **Horario del día** — wallpaper distinto para amanecer / día / atardecer / noche (usa el amanecer/atardecer local)
  - **Descarga diaria** — descarga un wallpaper nuevo de wallhaven cada mañana
- **Pool de imágenes** — rota entre tu librería local, resultados aleatorios de wallhaven, o una selección personalizada
- **Daemon en segundo plano** como servicio systemd de usuario — la rotación sigue activa aunque cierres la app
- **Librería** — visualiza, aplica y elimina los wallpapers descargados

---

## Arquitectura

```
wallhub/
├── apps/ui/                     # Frontend Next.js 15 (incrustado en la ventana Tauri)
├── crates/
│   ├── wallhub-core/            # Librería compartida: cliente API, scheduler, storage, IPC
│   ├── wallhub-gui/src-tauri/   # App de escritorio Tauri (ventana + comandos Rust)
│   └── wallhub-daemon/          # Daemon de rotación en segundo plano (servicio systemd)
└── Cargo.toml                   # Workspace Cargo
```

La GUI y el daemon son binarios separados. El daemon corre en segundo plano (~5–10 MB RAM) y gestiona la rotación aunque cierres la ventana. Se comunican vía socket Unix.

---

## Requisitos

| | |
|---|---|
| Sistema operativo | Linux — GNOME (Wayland/X11) o KDE Plasma 6 (Wayland/X11) |
| Rust | toolchain stable vía `rustup` |
| Node.js | 20+ |
| pnpm | 8+ |

### Paquetes del sistema — Arch / CachyOS

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

> Usuarios de KDE: `plasma-apply-wallpaperimage`, `kwriteconfig6` y `qdbus6` ya vienen incluidos con `plasma-workspace`. No se necesita instalar nada adicional.

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/StrykerUX/wallhub.git
cd wallhub
```

### 2. Instalar Rust

```bash
sudo pacman -S --needed rustup
rustup default stable
```

### 3. Instalar dependencias del frontend

```bash
cd apps/ui && pnpm install && cd ../..
```

### 4. Ejecutar en modo desarrollo

```bash
cd crates/wallhub-gui
WEBKIT_DISABLE_DMABUF_RENDERER=1 pnpm tauri dev
```

> `WEBKIT_DISABLE_DMABUF_RENDERER=1` previene un crash de WebKit en algunos setups de GNOME/Wayland. Se puede omitir en KDE o X11.

### 5. Configurar el daemon en segundo plano

El daemon gestiona la rotación de wallpapers de forma independiente a la GUI.

```bash
# Compilar el daemon (desde la raíz del repo)
cargo build --bin wallhub-daemon

# Crear el servicio systemd de usuario
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

Verifica que esté corriendo:

```bash
systemctl --user status wallhub-daemon
```

---

## Build de producción

```bash
cd crates/wallhub-gui
pnpm tauri build
```

Los bundles (`.deb`, AppImage, `.tar.gz`) quedan en `target/release/bundle/`.

Tras un build de producción, actualiza el `ExecStart` del servicio a `target/release/wallhub-daemon` y reinícialo:

```bash
systemctl --user daemon-reload && systemctl --user restart wallhub-daemon
```

---

## Configuración

La configuración se guarda en `~/.config/wallhub/config.toml` — se crea automáticamente al primer arranque. No es necesario editarlo manualmente; todo es configurable desde las páginas de Settings y Rotation de la app.

### API key de wallhaven (opcional)

Una API key desbloquea contenido NSFW y mayor límite de peticiones. Agrégala en **Settings → API Key** dentro de la app — se guarda en `config.toml`.

Obtén tu key en [wallhaven.cc/settings](https://wallhaven.cc/settings).

---

## Solución de problemas

**El wallpaper no cambió en GNOME?** Verifica desde la terminal:

```bash
gsettings get org.gnome.desktop.background picture-uri
gsettings get org.gnome.desktop.background picture-uri-dark
gsettings get org.gnome.desktop.screensaver picture-uri
```

**El wallpaper no cambió en KDE?** Verifica que `plasma-apply-wallpaperimage` esté disponible:

```bash
which plasma-apply-wallpaperimage
```

**El daemon no está rotando?** Revisa los logs:

```bash
journalctl --user -u wallhub-daemon -f
```

**El daemon sigue usando código viejo después de un cambio?** Recompila y reinicia:

```bash
cargo build --bin wallhub-daemon && systemctl --user restart wallhub-daemon
```

---

## Licencia

MIT
