FROM node:18-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.docker.json ./
RUN npm ci --ignore-scripts

COPY src ./src
RUN npm run build:docker

FROM node:18-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV WEB_PORT=51417

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts

COPY --from=builder /app/build/docker ./dist/

RUN mkdir -p /app/config

EXPOSE 51417

CMD ["node", "dist/docker/index.js"]
