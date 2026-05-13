FROM node:24-slim AS builder

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json tsconfig.docker.json tsconfig.webui.json vite.config.ts ./
RUN npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY src ./src
RUN npm run build:docker

FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV WEB_PORT=51417
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY --from=builder /app/build/docker ./dist/

RUN mkdir -p /app/config

EXPOSE 51417

CMD ["node", "dist/docker/index.js"]
