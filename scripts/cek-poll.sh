#!/bin/bash
# Cek perangkat mana saja yang polling /api/data (IP & frekuensi)
LOG=/var/log/nginx/access.log
echo "=== Semua hit GET /api/data (per IP, total) ==="
grep 'GET /api/data' "$LOG" 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
echo ""
echo "=== 15 menit terakhir: semua request per IP ==="
CUTOFF=$(date -d '15 minutes ago' '+%d/%b/%Y:%H:%M:%S')
awk -v cutoff="$CUTOFF" '{ line=$4; gsub(/\[/,"",line); if (line > cutoff) print $1 }' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -20
echo ""
echo "=== 15 menit terakhir: hit /api/data?keys per IP ==="
awk -v cutoff="$CUTOFF" '$0 ~ /GET \/api\/data\?/ { line=$4; gsub(/\[/,"",line); if (line > cutoff) print $1 }' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -20
echo ""
echo "=== Contoh 5 request /api/data terbaru ==="
grep 'GET /api/data' "$LOG" 2>/dev/null | tail -5 | awk '{print $1, $4, $7}'
