#!/usr/bin/env bash
# Visual e2e: vless:// address renders next to the subscription link
set -u
cd /home/z/my-project
DB=/tmp/vis-panel.db
PORT=8092
rm -f "$DB" /tmp/vis-cj.txt
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
echo "health: $code"

# seed one user with 2 vless proxies
CJ=/tmp/vis-cj.txt
curl -s -c "$CJ" -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' -d '{"password":"admin123"}' > /dev/null
curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients" -H 'Content-Type: application/json' \
  -d '{"name":"ali","trafficGb":10,"days":30,"protocol":"vless","address":"vps.example.com","port":443,"sni":"vps.example.com","transport":"ws","path":"/ws","tls":true}' > /dev/null
CID=$(curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/clients" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).clients[0].id))")
curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients/$CID/proxies" -H 'Content-Type: application/json' \
  -d '{"protocol":"vless","address":"vps2.example.com","port":2053,"sni":"vps2.example.com","transport":"grpc","path":"grpc-svc","tls":true,"remark":"Odyssey-ali-2"}' > /dev/null
echo "seed user ready"

# browser: login -> users view
agent-browser set viewport 1440 900 > /dev/null
agent-browser open "http://127.0.0.1:$PORT" > /dev/null
sleep 2
agent-browser find label "رمز مدیر" fill "admin123" > /dev/null 2>&1
sleep 1
agent-browser find role button click --name "ورود" > /dev/null 2>&1
sleep 3
agent-browser find role button click --name "کاربران" > /dev/null 2>&1
sleep 2
mkdir -p /tmp/render
agent-browser screenshot /tmp/render/vis-users.png && echo "users screenshot saved"
echo "--- vless links visible on users page ---"
agent-browser snapshot 2>/dev/null | grep -o "vless://[a-zA-Z0-9@:.?&=%#-]*" | head -4
# open detail dialog
agent-browser find text "ali" click > /dev/null 2>&1
sleep 1.5
agent-browser screenshot /tmp/render/vis-detail.png && echo "detail screenshot saved"
echo "--- vless links visible in detail dialog ---"
agent-browser snapshot 2>/dev/null | grep -o "vless://[a-zA-Z0-9@:.?&=%#-]*" | head -4
echo "--- browser errors ---"
agent-browser errors 2>/dev/null | head -5

kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "DONE"
