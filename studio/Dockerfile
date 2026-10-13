# Full Debian image: it ships OpenSSL, which Prisma needs.
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/studio.db \
    STORAGE_DIR=/data/storage
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
