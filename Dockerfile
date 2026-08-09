# syntax=docker/dockerfile:1

# --- Build stage ------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies and build the frontend and backend
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage -------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html

CMD ["node", "dist/server.cjs"]
