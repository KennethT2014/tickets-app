# Levantar CastleWalk Tickets

Con Docker, Bun y tres comandos el sistema queda usable en local: base de datos en `:8080`, API en `:3006` y web en `:3000`.

## Requisitos

- [Bun](https://bun.sh) `1.3.3`
- Node `>= 24`
- Docker Desktop (o Docker Engine + Compose)

Este repo declara Bun como package manager. No uses `npm run`.

## Quick path

1. Clona e instala:

```bash
git clone https://github.com/KennethT2014/tickets-app.git
cd tickets-app
bun install
```

2. Copia las variables de entorno:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

3. Arranca SQLite (libSQL), crea el esquema y siembra datos:

```bash
docker compose up -d
bun run db:setup
```

4. Levanta frontend y backend:

```bash
bun run dev
```

5. Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con `admin@castlewalk.us` / `Admin123!`.

## Cuentas demo

Todas las contraseñas de empleados son `CastleWalk1`.

| Correo | Rol en la demo |
|--------|----------------|
| `admin@castlewalk.us` | Admin global (`Admin123!`) |
| `sofia.hr@castlewalk.us` | Gestora de Human Resources |
| `lucia.hr@castlewalk.us` | Miembro de HR con permiso de cierre |
| `martin.employee@castlewalk.us` | Empleado de Payroll; puede crear tickets |
| `diego.ti@castlewalk.us` | Gestor de Support and TI |
| `camila.dev@castlewalk.us` | Gestora de Development |

## Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `docker compose up -d` | LibSQL/SQLite en `:8080` |
| `bun run db:setup` | Genera Prisma, aplica `prisma/init.sql` y ejecuta el seed |
| `bun run db:seed` | Solo vuelve a sembrar usuarios y áreas |
| `bun run dev` | Next (`:3000`) + Nest (`:3006`) |
| `bun run check-types` | Typecheck del monorepo |

`db:setup` no borra tablas si `User` ya existe. Para un reset limpio, para el contenedor, borra `data/libsql` y vuelve a correr `docker compose up -d` + `bun run db:setup`.

## Checklist

- [ ] `http://localhost:8080` responde (libSQL)
- [ ] `http://localhost:3006/api/health` devuelve `{ "ok": true }`
- [ ] `http://localhost:3000/login` muestra el login CastleWalk
- [ ] El admin ve Home, Tickets, Organization, Users y Areas

## Next step

Sigue el recorrido de un ticket en [usage.md](usage.md).
