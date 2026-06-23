# ---- Build stage: install workspaces and build the static web bundle ----
FROM node:22-alpine AS build
WORKDIR /app

# Copy workspace manifests first so `npm ci` is cached unless deps change.
COPY package.json package-lock.json ./
COPY metronome-engine/package.json metronome-engine/
COPY presets/package.json presets/
COPY web/package.json web/
RUN npm ci

# Copy the rest of the source and build.
COPY . .
# Empty base URL -> the app calls a relative "/api", which nginx proxies to the
# API container. (Local `npm run dev` still uses http://localhost:5046.)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build -w web

# ---- Runtime stage: nginx serves the files and proxies /api ----
FROM nginx:alpine AS final
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
