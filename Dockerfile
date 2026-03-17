# Stage 1: Build Admin Panel
FROM node:20-alpine AS admin-builder
WORKDIR /build
COPY web/admin/package.json web/admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/admin/ ./
RUN npm run build

# Stage 2: Production Runtime
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY server/main.py ./server/main.py
COPY server/__init__.py ./server/__init__.py

# Copy admin panel build
COPY --from=admin-builder /build/dist /var/www/admin

# Copy deploy configs
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/app.conf
COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create vpnapp user and data directories
RUN useradd -r -s /bin/false vpnapp && \
    mkdir -p /app/data /app/logs /var/log/supervisor && \
    chown -R vpnapp:vpnapp /app/data /app/logs

EXPOSE 80

CMD ["/app/entrypoint.sh"]
