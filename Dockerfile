FROM node:22-slim AS build
ARG BUILD_VERSION=dev
ENV VITE_APP_VERSION=$BUILD_VERSION
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3200
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
