FROM node:22-slim AS build
ARG BUILD_VERSION=dev
ENV VITE_APP_VERSION=$BUILD_VERSION
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx tsc -p tsconfig.server.json

FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./server
EXPOSE 3200
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
