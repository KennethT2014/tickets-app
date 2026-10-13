# CastleWalk Tickets

Sistema interno de tickets para empleados de CastleWalk: solicitudes entre áreas, gestores que asignan y cierran, y un organigrama visual.

## Quick path

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
bun run db:setup
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000) con `admin@castlewalk.us` / `Admin123!`.

## Documentación

La guía completa está en [`docs/`](docs/README.md):

- [Cómo levantarlo](docs/getting-started.md)
- [Cómo se usa](docs/usage.md)
- [Arquitectura](docs/architecture.md)
