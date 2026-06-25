# Mytronome

A cross-platform metronome with an accurate, fully client-side tick and savable presets. Web-first, with a shared framework-agnostic core so the same engine can power desktop and mobile clients later.

## What's in here

An npm-workspaces monorepo (TypeScript) alongside a separate .NET API. Top-level folders name the app's capabilities and surfaces, not generic layers:

| Folder | What it is |
|--------|-----------|
| `metronome-engine/` | Framework-agnostic tick engine: tempo, time signature, Web Audio scheduler. No UI framework. Shared by every front-end. |
| `presets/` | Framework-agnostic preset domain: types, the `PresetStore` contract, and pure helpers. |
| `web/` | The React + TypeScript (Vite) web client. |
| `preset-api/` | C#/.NET 10 minimal API: EF Core 9 (Pomelo MySQL) + ASP.NET Core Identity, with Scalar API docs. |
| `docker-compose.yml` | Full local/prod stack: MySQL + the API + the web app served by nginx. |

**Key pattern:** one `PresetStore` interface with three implementations — browser `localStorage`, the REST API, and Google Drive (`appDataFolder`). Switching storage only changes which implementation is used; the rest of the app is unaware. Adding a backend = a new implementation, nothing else.

## Getting started

**Prerequisites:** Node.js (LTS). For the full stack also Docker; for API development, the .NET 10 SDK.

### Web only (fastest loop)

```sh
npm install            # from the repo root — installs all workspaces
npm run dev -w web     # Vite dev server with hot reload
```

Open <http://localhost:5173>. Local presets and Google Drive work with no backend; the **Server** storage option calls the API at <http://localhost:5046> (run it via Docker, below, or `dotnet run` in `preset-api/`).

### Full stack (containers)

```sh
# 1. Create a .env at the repo root (gitignored) — see .env.example:
#    MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
docker compose up -d --build
```

- Web app (nginx serving the built SPA, proxying `/api`): <http://localhost:8080>
- API (also exposed directly; Scalar docs at `/scalar` in development): <http://localhost:5046>
- MySQL: `localhost:3306` (named volume `mysql-data`)

Rebuild just the web image: `docker compose up -d --build --no-deps web`. Stop: `docker compose down` (keep data) or `-v` (wipe).

## Configuration

| What | Where | Notes |
|------|-------|-------|
| MySQL credentials (compose) | `.env` (repo root, gitignored) | See `.env.example` for the variable names. |
| Google Drive client ID | `web/.env.local` → `VITE_GOOGLE_CLIENT_ID` | Public OAuth client ID. Baked into the web image at build time. |
| API DB connection string | user-secrets (local) **or** `ConnectionStrings__DefaultConnection` env var (Docker) | `appsettings.json` ships an empty-password placeholder; the real value never lives in a committed file. |

## Testing

```sh
npm test          # type-checks the suites (tsc) then runs Vitest
```

Suites live in each package's `test/` directory and cover the framework-agnostic core (the metronome engine, the preset domain, and the beat-relative subdivision logic).

## Status & roadmap

Milestones complete: metronome engine, local presets, REST API + MySQL (Dockerized), optional accounts (ASP.NET Identity), and Google Drive cloud storage. **The app is fully usable with no account** — an account is only needed for the "Server" storage option.

Next: additional front-ends (Tauri desktop first, then mobile via React Native) reusing `metronome-engine` + the `PresetStore` interface, plus production deployment (HTTPS).

## License

MIT — see [LICENSE](LICENSE).
