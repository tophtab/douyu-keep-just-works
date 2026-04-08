FROM node:18-slim

WORKDIR /app

# Install chromium for puppeteer
RUN apt-get update && apt-get install -y chromium --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY build/docker/ ./dist/
COPY package.json ./

RUN npm install --production --ignore-scripts

RUN mkdir -p /app/config

ENV CONFIG_PATH=/app/config/config.json
ENV TZ=Asia/Shanghai

CMD ["node", "dist/docker/index.js"]
