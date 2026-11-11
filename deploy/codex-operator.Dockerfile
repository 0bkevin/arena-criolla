FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global @openai/codex@0.162.1 \
    && codex --version \
    && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY scripts/creator-codex.ts ./scripts/creator-codex.ts
COPY scripts/creator-codex ./scripts/creator-codex
COPY tsconfig.json ./tsconfig.json
RUN mkdir /app/tests

ENV HOME=/operator
ENV CODEX_HOME=/operator/.codex
ENV ARENA_CODEX_PATH=/usr/local/bin/codex
ENV ARENA_CODEX_BILLING_POLICY=chatgpt-plan-and-credits
USER node
ENTRYPOINT ["/app/node_modules/.bin/tsx", "/app/scripts/creator-codex.ts"]
