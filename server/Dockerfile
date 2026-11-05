FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY server ./server
RUN npm install
RUN npm run build -w shared && npm run build -w server

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
