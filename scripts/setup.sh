#!/usr/bin/env bash
# greyGiraffe – one-command local setup. Safe to re-run.
#   pnpm bootstrap        (or: bash scripts/setup.sh)
#
# What it does:
#   1. checks Node >= 20 and pnpm (enables corepack if pnpm is missing)
#   2. installs dependencies (also generates the Prisma client)
#   3. creates .env from .env.example if missing and fills AUTH_SECRET / CRON_SECRET
#   4. makes sure a Postgres is reachable:
#        - uses DATABASE_URL from .env if it answers
#        - otherwise starts Postgres (+ Qdrant) with `docker compose up -d` on port 54329
#   5. applies migrations and seeds demo data (alice / bob / carol, password123)
#   6. imports this week's real ETH menus, re-seeds (synthetic vote history needs the menus), and builds
#      the popularity predictions (Qdrant if Docker is available, in-memory otherwise)
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

bold "1/5 Toolchain"
command -v node >/dev/null || die "Node.js is not installed. Install Node 20+ (https://nodejs.org) and re-run."
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || die "Node $(node -v) found, need 20 or newer."
if ! command -v pnpm >/dev/null; then
  echo "pnpm not found – enabling via corepack"
  corepack enable || die "Could not enable corepack. Install pnpm: npm i -g pnpm"
fi
echo "node $(node -v), pnpm $(pnpm -v)"

bold "2/5 Dependencies"
pnpm install --frozen-lockfile

bold "3/5 Environment file"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "created .env from .env.example"
fi
gen_secret() { openssl rand -base64 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'; }
if grep -q 'change-me' .env; then
  AUTH=$(gen_secret); CRON=$(gen_secret | tr -d '/+=' | cut -c1-32)
  # portable in-place edit (macOS/BSD sed and GNU sed)
  sed -i.bak -e "s#AUTH_SECRET=\"change-me[^\"]*\"#AUTH_SECRET=\"$AUTH\"#" -e "s#CRON_SECRET=\"change-me[^\"]*\"#CRON_SECRET=\"$CRON\"#" .env && rm -f .env.bak
  echo "filled AUTH_SECRET and CRON_SECRET"
fi

bold "4/5 Database"
db_url() { grep -E '^DATABASE_URL=' .env | head -1 | sed -E 's/^DATABASE_URL="?([^"]*)"?/\1/'; }
db_ok()  { node -e '
    const u = new URL(process.argv[1]); const net = require("net");
    const s = net.connect({ host: u.hostname, port: Number(u.port || 5432) });
    s.on("connect", () => { s.end(); process.exit(0); }); s.on("error", () => process.exit(1));
    setTimeout(() => process.exit(1), 2000);' "$1"; }
URL=$(db_url)
if [ -n "$URL" ] && db_ok "$URL"; then
  echo "using DATABASE_URL from .env ($(echo "$URL" | sed -E 's#//[^@]*@#//***@#'))"
else
  echo "DATABASE_URL in .env is not reachable – trying Docker"
  command -v docker >/dev/null || die "No reachable database and no Docker. Either: (a) install Docker Desktop, or (b) put a Neon/Postgres URL into DATABASE_URL and DIRECT_URL in .env, then re-run."
  docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker Desktop and re-run."
  docker compose up -d postgres qdrant >/dev/null
  echo "started Postgres (54329) and Qdrant (6333) via docker compose"
  LOCAL='postgresql://postgres:postgres@127.0.0.1:54329/greygiraffe'
  sed -i.bak -e "s#^DATABASE_URL=.*#DATABASE_URL=\"$LOCAL\"#" -e "s#^DIRECT_URL=.*#DIRECT_URL=\"$LOCAL\"#" .env && rm -f .env.bak
  for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  echo "wrote local DATABASE_URL/DIRECT_URL into .env"
fi

bold "5/6 Schema + seed"
pnpm exec prisma migrate deploy
pnpm exec prisma db seed

bold "6/6 Menus + predictions"
# Qdrant: start it if Docker is around (harmless if already running); otherwise the in-memory fallback is used
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then docker compose up -d qdrant >/dev/null 2>&1 && echo "qdrant up (docker compose)"; fi
if pnpm import:menus eth >/dev/null 2>&1; then
  echo "imported this week's ETH menus (photos resized + cached)"
  pnpm exec prisma db seed >/dev/null 2>&1 && echo "seeded synthetic vote history on this week's menus"
  pnpm popularity 2>/dev/null | grep -E '^\{' || echo "popularity step skipped (see: pnpm popularity)"
else
  echo "ETH menu import failed (offline?). Seeded demo dishes are still there; run: pnpm import:menus"
fi

bold "Done."
cat <<MSG

  Start the app:        pnpm dev         → http://localhost:3001
  Log in as:            alice / password123   (also bob, carol)
  Re-import menus:      pnpm import:menus      Predictions: pnpm popularity      Reset demo: pnpm demo:reset
  Checks:               pnpm typecheck && pnpm lint && pnpm test

  Phone on the same Wi-Fi: add  AUTH_URL=http://<your-LAN-IP>:3001  to .env, then open that URL.
MSG
