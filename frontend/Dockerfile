# The web image: the built SPA behind nginx, which proxies /api to the API (API_UPSTREAM).
# Built from the repository root (compose and CI pass `context: .`).
FROM node:26-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# Runs as an unprivileged user on 8080.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
# Where the API is: the compose service by default; on Unraid, the API container's name.
ENV API_UPSTREAM=backend:8000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]
