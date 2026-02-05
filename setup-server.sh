#!/bin/bash

# Stop script on error
set -e

# Deployment triggered
export DEBIAN_FRONTEND=noninteractive

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 EUBIKE SERVER SETUP"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Prepare directories
DEPLOY_DIR="/root/eubike"
mkdir -p "$DEPLOY_DIR"

# 2. Extract Delta Update
if [ -f "/root/deploy_delta.zip" ]; then
    echo "📦 Applying incremental updates..."
    unzip -o /root/deploy_delta.zip -d "$DEPLOY_DIR"
    rm /root/deploy_delta.zip
    echo "✅ Delta applied."
else
    echo "ℹ️ No delta zip found. Skipping extraction."
fi

# 3. Handle Deletions
if [ -f "$DEPLOY_DIR/delete_files.txt" ]; then
    echo "🗑️ Processing deletions..."
    while IFS= read -r file; do
        if [ ! -z "$file" ]; then
            rm -f "$DEPLOY_DIR/$file"
            echo "   Deleted: $file"
        fi
    done < "$DEPLOY_DIR/delete_files.txt"
    rm "$DEPLOY_DIR/delete_files.txt"
fi

# 4. Smart Dependency Install (only backend - frontend is pre-built)
install_deps() {
    local dir=$1
    if [ -d "$dir" ]; then
        if [ ! -d "$dir/node_modules" ] || [ "$dir/package.json" -nt "$dir/node_modules" ]; then
            echo "📦 Installing dependencies in $dir..."
            cd "$dir"
            npm install --prefer-offline --no-audit --progress=false --omit=dev
            touch node_modules
        else
            echo "✅ Dependencies up to date in $dir"
        fi
    fi
}

echo ""
echo "📦 Checking dependencies..."
install_deps "$DEPLOY_DIR/backend"

# 5. Frontend is pre-built - just verify and copy to web root
echo ""
echo "🔍 Verifying frontend build..."
if [ -d "$DEPLOY_DIR/frontend/dist" ]; then
    FILE_COUNT=$(find "$DEPLOY_DIR/frontend/dist" -type f | wc -l)
    echo "✅ Frontend dist exists ($FILE_COUNT files)"
    
    # Copy frontend files to web root
    echo "📤 Copying frontend files to /var/www/html..."
    rm -rf /var/www/html/*
    cp -r "$DEPLOY_DIR/frontend/dist"/* /var/www/html/
    chown -R www-data:www-data /var/www/html
    echo "✅ Frontend files copied to web root"
else
    echo "⚠️ WARNING: Frontend dist missing! Build locally and redeploy."
fi

# 6. Run Migrations (if needed)
echo ""
echo "🔄 Running migrations..."
if [ -f "$DEPLOY_DIR/backend/scripts/migrate_catalog_columns.js" ]; then
    cd "$DEPLOY_DIR/backend"
    node scripts/migrate_catalog_columns.js 2>/dev/null || echo "   Migration skipped (already applied)"
fi

# 7. Configure Nginx (if needed)
if [ -f "/etc/nginx/sites-available/default" ]; then
    NGINX_CONF="/etc/nginx/sites-available/default"
    if ! grep -q "location /images/" "$NGINX_CONF"; then
        echo "🔧 Patching Nginx config..."
        sed -i '/location \/api\/ {/i \    location /images/ {\n        proxy_pass http://127.0.0.1:8082/images/;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n    }\n' "$NGINX_CONF"
        nginx -t && service nginx reload
        echo "✅ Nginx patched"
    fi
fi

# 8. Restart PM2 Services
echo ""
echo "🔄 Restarting services..."
cd "$DEPLOY_DIR"

# Stop all first
pm2 stop all 2>/dev/null || true

# Start with ecosystem config
pm2 startOrReload ecosystem.config.js --update-env

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔥 Hunter will run every hour at :05"
echo "📊 Ranks will recompute every hour at :35"
echo ""
