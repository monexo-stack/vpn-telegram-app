#!/bin/bash
# Copy custom stickers over default ones (if any exist)
if [ -d /app/custom/stickers ] && ls /app/custom/stickers/*.tgs 1>/dev/null 2>&1; then
    cp /app/custom/stickers/*.tgs /var/www/app/
    echo "Custom stickers applied from /app/custom/stickers/"
fi

# Run database init on startup
echo "Initializing database..."

# Start supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
