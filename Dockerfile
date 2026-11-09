# Imagem única do portal: a API (Node) também serve o site já compilado.

FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public public
COPY src src
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=8080 \
    PUBLIC_DIR=/app/public \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
RUN mkdir -p /data/uploads && chown -R node:node /data
COPY --from=api /app/node_modules node_modules
COPY --from=api /app/dist dist
COPY server/package.json ./
COPY server/migrations migrations
COPY --from=web /app/dist public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "dist/index.js"]
