# Chat2API Web Deployment Guide

This document describes how to run the **Web edition** of Chat2API on a server
(VPS, container host, etc.) for 24/7 use. The legacy Electron desktop edition
is no longer required.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Single Node.js process                  │
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│ │ /v1/* OpenAI API │  │ /v0/management/* │  │ /  static  │  │
│ └──────────────────┘  └──────────────────┘  │   web UI   │  │
└─────────────────────────────────────────────┴────────────┴──┘
            ▲                    ▲                    ▲
            │                    │                    │
        AI clients          Browser (UI)       Browser (UI)
```

A single port serves three things:

1. **`/v1/*`** – the OpenAI-compatible proxy that AI clients talk to.
2. **`/v0/management/*`** – the management HTTP API used by the web UI to
   configure providers, accounts, API keys, view logs, etc. Protected by a
   bearer secret.
3. **`/`** – the built React UI (when `dist/frontend` is present).

## Quick start with Docker

```bash
# Build and start
docker compose up -d --build

# Watch the first-boot log to capture the auto-generated Management secret
docker compose logs -f chat2api
```

On first boot you will see something like:

```
================================================================
  First run detected.
  Open the web UI to create your administrator password.
  Until you do, the management API will reject every request
  except /v0/management/auth/{status,setup,login}.
================================================================
```

Open `http://your-server:8080/`. You will be greeted with a "Create
administrator password" screen — pick a password (8+ chars), submit, and
you are in. The password can be changed later from **Settings → Security →
Administrator Password**.

> **Tip:** in headless deployments you can skip the web first-run flow
> entirely by setting `CHAT2API_MANAGEMENT_SECRET` in `.env`. Chat2API
> then uses that value as the long-lived secret and treats setup as
> already done. You will still need to set a password from the UI later
> if you want a friendly login screen.

## Quick start without Docker

```bash
# 1. Install Node.js 18+ and clone the repository.
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# 2. Install dependencies and build.
npm ci
npm run build

# 3. Optional: copy and edit environment defaults.
cp .env.example .env

# 4. Start.
npm start
```

The backend binds on `0.0.0.0:8080` by default.

## Persisting data

User data (encrypted credentials, configuration, logs) lives under
`CHAT2API_DATA_DIR` (default: `~/.chat2api`).

When deploying with Docker the compose file mounts a named volume at `/data`
so data survives container rebuilds. Back this directory up if you care
about your provider accounts and API keys.

## Reverse proxy / TLS

Chat2API itself speaks plain HTTP. For production deployments put it behind
a reverse proxy (Caddy / Nginx / Traefik / Cloudflare) that terminates TLS:

### Caddy example

```caddyfile
chat2api.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name chat2api.example.com;

    # ... certificate config ...

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / streaming responses from /v1/chat/completions need a long timeout.
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Address to bind. Use `127.0.0.1` if behind a reverse proxy on the same host. |
| `PORT` | `8080` | Port for the unified web UI + API. |
| `CHAT2API_DATA_DIR` | `~/.chat2api` | Directory to persist config, logs, and encryption key. |
| `CHAT2API_MANAGEMENT_SECRET` | _(auto)_ | Pin the management API secret. Recommended in production. |
| `CHAT2API_DISABLE_MANAGEMENT_API` | `0` | Set to `1` to disable the management API and web UI auth surface. |
| `CHAT2API_ENCRYPTION_KEY` | _(auto)_ | Pin the credential encryption key. |
| `CHAT2API_FRONTEND_DIR` | _auto-detected_ | Path to the built frontend. Override only when running unconventionally. |

## Health and stats

- `GET /health` – returns proxy running status and aggregate stats.
- `GET /stats` – returns detailed counters (requests, latencies, etc.).

Wire these into your uptime / Prometheus stack for alerting.

## Running as a systemd service

```ini
# /etc/systemd/system/chat2api.service
[Unit]
Description=Chat2API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=chat2api
WorkingDirectory=/opt/chat2api
EnvironmentFile=/etc/chat2api.env
ExecStart=/usr/bin/node dist/backend/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chat2api
sudo journalctl -u chat2api -f
```

## Migrating from the Electron desktop edition

Copy the contents of `~/.chat2api/` from your old machine to the new
deployment's `CHAT2API_DATA_DIR`. If you also bring over the
`.encryption_key` file your encrypted credentials will decrypt without
re-entry.
