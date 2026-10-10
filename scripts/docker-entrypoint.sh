#!/usr/bin/env bash
# Container start: wait for Postgres, apply migrations, optional first-boot data, then serve.
#   SEED_DEMO=true         seed allergens/mensas/demo users (idempotent)
#   IMPORT_ON_START=true   import this week's ETH menus + photos + predictions (needs internet)
set -euo pipefail
cd /app
export PATH="/app/node_modules/.bin:$PATH"

echo "[entrypoint] waiting for database + applying migrations"
for i in $(seq 1 60); do
  if prisma migrate deploy >/tmp/migrate.log 2>&1; then echo "[entrypoint] migrations applied"; break; fi
  if [ "$i" = 60 ]; then echo "[entrypoint] database not reachable:"; cat /tmp/migrate.log; exit 1; fi
  sleep 2
done

# order matters on a fresh database: base data → menus → demo data that depends on menus → predictions
if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "[entrypoint] seeding base + demo data"
  tsx prisma/seed.ts
fi
if [ "${IMPORT_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] importing menus (ETH API) + photos"
  POPULARITY_ON_IMPORT=false tsx scripts/import.ts all || echo "[entrypoint] import failed (no internet?) – continuing"
  if [ "${SEED_DEMO:-false}" = "true" ]; then
    echo "[entrypoint] seeding demo data that depends on the menus (synthetic votes, yesterday)"
    tsx prisma/seed.ts
  fi
fi
if [ "${IMPORT_ON_START:-false}" = "true" ] || [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "[entrypoint] building popularity predictions"
  tsx scripts/popularity.ts || echo "[entrypoint] popularity step skipped"
fi

echo "[entrypoint] starting greyGiraffe on :3000"
exec next start -p 3000 -H 0.0.0.0
