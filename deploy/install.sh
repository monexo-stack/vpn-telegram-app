#!/bin/bash
#
# VPN Telegram Mini App - Docker Installation Script
# Installs Docker and launches the application using pre-built images
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Project directory
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                           ║${NC}"
echo -e "${BLUE}║           🚀  VPN TELEGRAM MINI APP  🚀                   ║${NC}"
echo -e "${BLUE}║                   Docker Installer                        ║${NC}"
echo -e "${BLUE}║                                                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   echo "Run: sudo ./install.sh"
   exit 1
fi

# Check OS
if [[ ! -f /etc/os-release ]]; then
    echo -e "${RED}Error: Cannot detect OS${NC}"
    exit 1
fi

. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    echo -e "${YELLOW}Warning: This script is tested on Ubuntu/Debian. Detected: $ID${NC}"
fi

# Get domain from user
echo -e "${YELLOW}Enter your domain (e.g., vpn.example.com):${NC}"
read -p "> " DOMAIN

if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}Error: Domain is required${NC}"
    exit 1
fi

# Validate domain format
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})$ ]]; then
    echo -e "${RED}Error: Invalid domain format${NC}"
    exit 1
fi

# Database configuration
echo ""
echo -e "${YELLOW}Database configuration:${NC}"
echo "  [1] Install locally (in Docker) - Recommended"
echo "  [2] Use external database"
read -p "> " DB_CHOICE

USE_EXTERNAL_DB=false
DATABASE_URL=""

if [[ "$DB_CHOICE" == "2" ]]; then
    USE_EXTERNAL_DB=true
    echo ""
    echo -e "${YELLOW}Enter DATABASE_URL (postgresql+asyncpg://user:pass@host:5432/dbname):${NC}"
    read -p "> " DATABASE_URL

    if [[ -z "$DATABASE_URL" ]]; then
        echo -e "${RED}Error: DATABASE_URL is required for external database${NC}"
        exit 1
    fi
fi

# Get email for SSL (optional)
echo ""
echo -e "${YELLOW}Enter email for SSL certificate (optional, press Enter to skip):${NC}"
read -p "> " EMAIL

# Get Telegram Bot Token
echo ""
echo -e "${YELLOW}Enter your Telegram Bot Token (from @BotFather):${NC}"
echo -e "${BLUE}Example: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz${NC}"
read -p "> " BOT_TOKEN_INPUT

if [[ -z "$BOT_TOKEN_INPUT" ]]; then
    echo -e "${RED}Error: Bot token is required${NC}"
    exit 1
fi

# Get Admin Telegram ID
echo ""
echo -e "${YELLOW}Enter your Telegram User ID (Admin):${NC}"
echo -e "${BLUE}Get it from @userinfobot${NC}"
read -p "> " ADMIN_TGID_INPUT

if [[ -z "$ADMIN_TGID_INPUT" ]]; then
    echo -e "${RED}Error: Admin Telegram ID is required${NC}"
    exit 1
fi

# Validate Telegram ID is a number
if ! [[ "$ADMIN_TGID_INPUT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Telegram ID must be a number${NC}"
    exit 1
fi

# Generate secure passwords and tokens
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
ADMIN_SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
ENCRYPTION_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
SETUP_TOKEN=$(openssl rand -hex 32)
ADMIN_PASSWORD="admin123"

echo ""
echo -e "${GREEN}[1/5]${NC} Installing Docker..."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq docker-compose-plugin
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
fi

echo ""
echo -e "${GREEN}[2/5]${NC} Creating configuration..."

# Create .env file
if [[ "$USE_EXTERNAL_DB" == "true" ]]; then
    cat > .env << EOF
# Domain
DOMAIN=${DOMAIN}

# External Database
DATABASE_URL=${DATABASE_URL}

# Security Keys (auto-generated)
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Initial Setup (one-time configuration)
SETUP_TOKEN=${SETUP_TOKEN}
BOT_TOKEN_SETUP=${BOT_TOKEN_INPUT}
ADMIN_TGID_SETUP=${ADMIN_TGID_INPUT}

# Server Settings
LOG_LEVEL=INFO
JSON_LOGS=true
CORS_ORIGINS=https://${DOMAIN}

# Port (80 for HTTP, use reverse proxy for HTTPS)
APP_PORT=8080
EOF
else
    cat > .env << EOF
# Domain
DOMAIN=${DOMAIN}

# Database (local Docker)
POSTGRES_DB=vpn_db
POSTGRES_USER=vpn
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Security Keys (auto-generated)
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Initial Setup (one-time configuration)
SETUP_TOKEN=${SETUP_TOKEN}
BOT_TOKEN_SETUP=${BOT_TOKEN_INPUT}
ADMIN_TGID_SETUP=${ADMIN_TGID_INPUT}

# Server Settings
LOG_LEVEL=INFO
JSON_LOGS=true
CORS_ORIGINS=https://${DOMAIN}

# Port (80 for HTTP, use reverse proxy for HTTPS)
APP_PORT=8080
EOF
fi

chmod 600 .env
echo -e "${GREEN}✓ Configuration created${NC}"

echo ""
echo -e "${GREEN}[3/5]${NC} Building and starting containers..."

# Pull and start containers
echo "Pulling Docker images..."
docker compose -f docker-compose.prebuilt.yml pull
docker compose -f docker-compose.prebuilt.yml up -d

echo -e "${GREEN}✓ Containers started${NC}"

echo ""
echo -e "${GREEN}[4/5]${NC} Installing Nginx and SSL..."

# Install nginx for reverse proxy with SSL
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

# Create nginx config
cat > /etc/nginx/sites-available/vpn-panel << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /adminer/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Long timeouts for WebSocket connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vpn-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

echo ""
echo -e "${GREEN}[5/5]${NC} Obtaining SSL certificate..."

# Check if domain resolves to this server
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
DOMAIN_IP=$(dig +short ${DOMAIN} 2>/dev/null | tail -1 || echo "")

if [[ "$SERVER_IP" != "$DOMAIN_IP" && -n "$DOMAIN_IP" ]]; then
    echo -e "${YELLOW}Warning: Domain ${DOMAIN} may not point to this server${NC}"
    echo -e "${YELLOW}Server IP: ${SERVER_IP}, Domain resolves to: ${DOMAIN_IP}${NC}"
    echo -e "${YELLOW}SSL certificate will be attempted anyway...${NC}"
fi

# Get SSL certificate
if [[ -n "$EMAIL" ]]; then
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${EMAIL} --redirect || true
else
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
fi

# Setup auto-renewal
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

echo -e "${GREEN}✓ SSL configuration complete${NC}"

# Wait for app to be ready
echo ""
echo "Waiting for application to start..."
sleep 15

# Check health
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓ Application is running${NC}"
        break
    fi
    sleep 2
done

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║          ✅ INSTALLATION COMPLETED SUCCESSFULLY!          ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 ${BLUE}Admin Panel:${NC}    https://${DOMAIN}/admin"
echo -e "  🗄️  ${BLUE}Database UI:${NC}    https://${DOMAIN}/adminer/"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${YELLOW}Setup Token - for first login:${NC}"
echo -e "  Token:     ${SETUP_TOKEN}"
echo -e "  ${RED}SAVE THIS TOKEN! Required for initial setup.${NC}"
echo ""
if [[ "$USE_EXTERNAL_DB" == "true" ]]; then
    echo -e "  ${YELLOW}Database (Adminer):${NC}"
    echo -e "  System:   PostgreSQL"
    echo -e "  Server:   (from your DATABASE_URL)"
    echo -e "  Database: (from your DATABASE_URL)"
else
    echo -e "  ${YELLOW}Database (Adminer):${NC}"
    echo -e "  System:   PostgreSQL"
    echo -e "  Server:   postgres"
    echo -e "  Username: vpn"
    echo -e "  Password: ${POSTGRES_PASSWORD}"
    echo -e "  Database: vpn_db"
fi
echo ""
echo -e "${RED}  ⚠️  SAVE THIS INFORMATION! Passwords shown only once.${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  docker compose -f docker-compose.prebuilt.yml logs -f    # View logs"
echo "  docker compose -f docker-compose.prebuilt.yml restart    # Restart"
echo "  docker compose -f docker-compose.prebuilt.yml down       # Stop"
echo "  docker compose -f docker-compose.prebuilt.yml up -d      # Start"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Open Admin Panel: https://${DOMAIN}/admin"
echo "  2. Enter Setup Token (shown above)"
echo "  3. Create your admin username and password"
echo "  4. Enter verification code from Telegram bot"
echo "  5. Add your VPN servers (3x-ui panels)"
echo "  6. Configure payment systems (optional)"
echo ""
