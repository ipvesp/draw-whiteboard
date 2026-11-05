FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY client ./client
RUN npm install
RUN npm run build -w shared && npm run build -w client

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
