# greyGiraffe – single app image (Next.js server + CLI scripts + baked embedding model).
# Build:  docker build -t greygiraffe .      Run everything: docker compose -f docker-compose.prod.yml up -d
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 \
    TRANSFORMERS_CACHE=/app/.cache/transformers HF_HUB_DISABLE_TELEMETRY=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# dependencies (prisma generate runs in postinstall, so the schema must be present)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# app
COPY . .
RUN pnpm exec prisma generate && pnpm exec next build

# bake the sentence-embedding model into the image so the VM never needs to download it
RUN node scripts/warm-model.mjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["bash", "scripts/docker-entrypoint.sh"]
