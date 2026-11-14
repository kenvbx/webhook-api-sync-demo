FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
COPY public ./public
COPY .env.example ./
RUN mkdir -p /app/data
ENV NODE_ENV=production PORT=3010 DATABASE_PATH=/app/data/webhooks.sqlite
EXPOSE 3010
CMD ["node", "dist/src/server.js"]
