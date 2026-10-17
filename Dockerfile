FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY workers/video/package.json workers/video/package.json
COPY workers/transcription/package.json workers/transcription/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @lynvado/database build \
 && pnpm --filter api build \
 && pnpm --filter @lynvado/video-worker build \
 && pnpm --filter @lynvado/transcription-worker build \
 && pnpm --filter web build

FROM build AS api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM build AS web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]

FROM build AS video-worker
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
CMD ["node", "workers/video/dist/index.js"]

FROM build AS transcription-worker
ENV NODE_ENV=production
CMD ["node", "workers/transcription/dist/index.js"]

FROM build AS migrate
CMD ["pnpm", "--filter", "@lynvado/database", "db:migrate"]
