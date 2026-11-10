#!/usr/bin/env bash
# E2E test: vless:// address shown alongside subscription link (data-level check)
set -u
cd /home/z/my-project
DB=/tmp/e2e-panel.db
PORT=8091
rm -f "$DB" /tmp/e2e-cj.txt
export DATABASE_URL="file:$DB"
export PORT

# replicate boot.sh: restore schema from template, then seed admin
node scripts/ensure-db.mjs
node prisma/seed.boot.mjs

node .next/standalone/server.js > /tmp/e2e-server.log 2>&1 &
SRV=$!

for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/me" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "health: $code"

CJ=/tmp/e2e-cj.txt
echo "--- login ---"
curl -s -c "$CJ" -X POST "http://127.0.0.1:$PORT/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"password":"admin123"}'
echo ""

echo "--- create user ali (vless) ---"
CREATE=$(curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients" \
  -H 'Content-Type: application/json' \
  -d '{"name":"ali","trafficGb":10,"days":30,"protocol":"vless","address":"vps.example.com","port":443,"sni":"vps.example.com","transport":"ws","path":"/ws","tls":true}')
echo "$CREATE" | head -c 400; echo ""

CID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).client.id)}catch(e){console.log('')}})")

echo "--- create second proxy on same user (trojan) ---"
curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients/$CID/proxies" \
  -H 'Content-Type: application/json' \
  -d '{"protocol":"vless","address":"vps2.example.com","port":2053,"sni":"vps2.example.com","transport":"grpc","path":"grpc-svc","tls":true,"remark":"Odyssey-ali-2"}' | head -c 300; echo ""

echo "--- GET client: fields the UI builds vless:// from ---"
curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/clients/$CID" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const c=JSON.parse(d).client
  console.log('client:', c.name, '| proxies:', c.proxies.length)
  for (const p of c.proxies) {
    const ok = p.protocol && p.secret && p.address && p.port
    console.log('  -', p.protocol, p.remark, p.address+':'+p.port, 'transport='+p.transport, 'tls='+p.tls, ok?'OK':'MISSING FIELDS')
  }
})"

echo "--- subscription raw endpoint (server-side vless build) ---"
TOKEN=$(curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/clients/$CID" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).client.subToken))")
curl -s "http://127.0.0.1:$PORT/api/sub/$TOKEN?format=raw" | head -4

echo ""
echo "--- UI page serves ---"
curl -s -o /dev/null -w "login page: %{http_code}\n" "http://127.0.0.1:$PORT/"
grep -c "vless" /dev/null 2>/dev/null || true

kill $SRV 2>/dev/null
wait $SRV 2>/dev/null
echo "DONE"
