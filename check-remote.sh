#!/bin/bash
echo "📊 Remote Server Status"
echo ""
ssh root@45.9.41.232 "cd /root/eubike && sqlite3 backend/database/eubike.db 'SELECT COUNT(*) as total FROM market_history;' && echo 'Images:' && ls -1 frontend/public/images/bikes/*.webp 2>/dev/null | wc -l"
