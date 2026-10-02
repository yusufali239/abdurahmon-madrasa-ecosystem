# Backend (NestJS API + grammY bot + cron + BullMQ) — production obrazi
# Qurish: docker build -f backend/Dockerfile -t madrasa-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY miniapp/package.json miniapp/
COPY admin/package.json admin/
COPY prisma prisma
RUN npm ci --include=dev
COPY backend backend
RUN npx prisma generate && npm run build -w backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Bishkek
RUN apk add --no-cache tzdata openssl
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/prisma prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/backend/package.json backend/
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/uploads backend/uploads
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema ../prisma/schema.prisma && node dist/main.js"]
