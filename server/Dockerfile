FROM node:20-alpine AS builder

WORKDIR /app

# Build frontend client
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

COPY server ./server

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["npx", "tsx", "src/index.ts"]
