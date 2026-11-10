#!/usr/bin/env bash
# Visual e2e part 2: detail dialog with config addresses
set -u
cd /home/z/my-project
DB=/tmp/vis-panel.db
PORT=8092
export DATABASE_URL="file:$DB"
export PORT

node scripts/ensure-db.mjs > /dev/null 2>&1
node prisma/seed.boot.mjs > /dev/null 2>&1

node .next/standalone/server.js > /tmp/vis-server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/me" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "health: $code (db kept from previous run — user ali exists)"

agent-browser set viewport 1440 900 > /dev/null
agent-browser open "http://127.0.0.1:$PORT" > /dev/null
sleep 2
agent-browser find label "رمز مدیر" fill "admin123" > /dev/null 2>&1
sleep 1
agent-browser find role button click --name "ورود" > /dev/null 2>&1
sleep 3
agent-browser find role button click --name "کاربران" > /dev/null 2>&1
sleep 2
agent-browser find role button click --name "ali" > /dev/null 2>&1
sleep 2
mkdir -p /tmp/render
agent-browser screenshot --full /tmp/render/vis-detail2.png && echo "detail screenshot saved"
echo "--- config address section in dialog ---"
agent-browser snapshot 2>/dev/null | grep -E "آدرس کانفیگ|vless://" | head -6
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "DONE"
