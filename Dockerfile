FROM oven/bun:alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 4200
RUN bun run ng build
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/iot-project/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
