# Meal Planner

[![GitHub Release](https://img.shields.io/github/v/release/flyingfinger1/meal-planner)](https://github.com/flyingfinger1/meal-planner/releases)
[![Docker Image](https://img.shields.io/badge/ghcr.io-meal--planner-blue?logo=docker)](https://ghcr.io/flyingfinger1/meal-planner)
[![Node](https://img.shields.io/badge/node-22-brightgreen?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/github/license/flyingfinger1/meal-planner)](LICENSE)

A self-hosted weekly meal planning app with multi-user support, shopping list management and [Bring!](https://www.getbring.com/) integration.

<img width="651" height="1280" alt="image" src="https://github.com/user-attachments/assets/60fbfb03-bdd6-4046-9170-502f1b206504" />

## Features

- 7-day weekly meal plan (breakfast, lunch, dinner) — multiple meals per slot
- Meal database with ingredients grouped by category
- Automatic shopping list aggregation from planned meals
- Export shopping lists to the Bring! app
- Reusable quick lists (e.g. for recurring shopping trips)
- iCalendar integration (show calendar events alongside meals)
- Multi-user support with households/groups
- Email + Google OAuth login
- Invite members via link or optional email (SMTP)
- Role-based group settings (owner vs. member)
- PWA support (installable on mobile)

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Backend:** Node.js, Express, SQLite (via sql.js)
- **Deployment:** Docker

## Deployment

### Docker Compose

```yaml
services:
  meal-planner:
    image: ghcr.io/flyingfinger1/meal-planner:latest
    restart: unless-stopped
    env_file: .env
    environment:
      DB_PATH: /data/meal-planner.sqlite
    volumes:
      - meal-planner-data:/data
    ports:
      - "3200:3200"

volumes:
  meal-planner-data:
```

Then create a `.env` file (see [Environment Variables](#environment-variables)) and run:

```bash
docker compose up -d
```

### With a Reverse Proxy

The example above exposes port `3200` directly. In production you'll typically put a reverse proxy in front of the container for TLS termination.

**Caddy** (using [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy)):

```yaml
services:
  meal-planner:
    image: ghcr.io/flyingfinger1/meal-planner:latest
    restart: unless-stopped
    env_file: .env
    environment:
      DB_PATH: /data/meal-planner.sqlite
    volumes:
      - meal-planner-data:/data
    networks:
      - caddy-net
    labels:
      caddy: meal-planner.example.com
      caddy.reverse_proxy: "{{upstreams 3200}}"

volumes:
  meal-planner-data:

networks:
  caddy-net:
    external: true
```

For other reverse proxies (Nginx, Traefik, etc.) configure them to forward requests to port `3200`.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | **Yes** | Secret for signing JWT session tokens. Use a long random string and keep it stable across restarts. |
| `APP_URL` | **Yes** | Public URL of the app (e.g. `https://meals.example.com`). Used for invite links and post-OAuth redirects. |
| `BACKEND_URL` | **Yes** | URL of the backend. In production same as `APP_URL`. In development `http://localhost:3200`. |
| `DB_PATH` | No | Path to the SQLite database file. Defaults to `./meal-planner.sqlite`. |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID. If omitted, Google login is hidden. |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret. |
| `SMTP_HOST` | No | SMTP server for sending invitation emails. If omitted, only invite links are used. |
| `SMTP_PORT` | No | SMTP port. Defaults to `587`. |
| `SMTP_USER` | No | SMTP username. |
| `SMTP_PASS` | No | SMTP password. |
| `SMTP_FROM` | No | Sender address for invitation emails. |
| `DAILY_INVITE_LIMIT_PER_USER` | No | Max invitations a user can send per day. Defaults to `10`. |
| `DAILY_INVITE_LIMIT_PER_EMAIL` | No | Max invitations per recipient email per day. Defaults to `3`. |

### Google OAuth Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google+ API** and create OAuth 2.0 credentials
3. Add `https://your-domain.com/api/auth/google/callback` as an authorised redirect URI
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your `.env`

## Local Development

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:3100`, the backend on `http://localhost:3200`. The frontend proxies all `/api` requests to the backend automatically.

For Google OAuth in development set `BACKEND_URL=http://localhost:3200` in your `.env`.

## Building the Docker Image

```bash
docker build -t meal-planner .
```
