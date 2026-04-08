# Meal Planner

A self-hosted weekly meal planning app with shopping list management and [Bring!](https://www.getbring.com/) integration.

![Screenshot placeholder]()

## Features

- 7-day weekly meal plan (breakfast, lunch, dinner)
- Meal database with ingredients grouped by category
- Automatic shopping list aggregation from planned meals
- Export shopping lists to the Bring! app
- Reusable quick lists (e.g. for recurring shopping trips)
- iCalendar integration (show calendar events alongside meals)
- Optional password protection
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
    image: ghcr.io/youruser/meal-planner:latest
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
    image: ghcr.io/youruser/meal-planner:latest
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

| Variable        | Required | Description |
|-----------------|----------|-------------|
| `AUTH_PASSWORD` | No       | Password to protect the app. If not set, no login is required. |
| `AUTH_SECRET`   | No       | Secret for signing JWT session tokens. Randomly generated on each start if not set — set this explicitly to keep sessions valid across restarts. |
| `DB_PATH`       | No       | Path to the SQLite database file. Defaults to `./meal-planner.sqlite`. |

## Local Development

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`, the backend on `http://localhost:3200`.

## Building the Docker Image

```bash
docker build -t meal-planner .
```
