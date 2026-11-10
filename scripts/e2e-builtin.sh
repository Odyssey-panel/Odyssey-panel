#!/usr/bin/env bash
# Full local e2e for the built-in backend + normalization:
#  edge.js (front router) + next standalone + xray + raw vless client test
set -u
cd /home/z/my-project

DB=/tmp/e2e-builtin.db
PUB=8091        # public port (edge.js)
NXT=8092        # next standalone
rm -f "$DB" "$DB-journal" /tmp/xray/xray.pid /tmp/xray/xray.log
cp prisma/template.db "$DB"

export DATABASE_URL="file:$DB"
export PORT=$PUB NEXT_PORT=$NXT
export XRAY_BIN=/home/z/my-project/bin/xray
export XRAY_WS_PORT=18091

# edge.js expects the standalone root as cwd (same as production /app)
cd .next/standalone
node scripts/edge.js > /tmp/e2e-edge.log 2>&1 &
EDGE=$!
trap 'kill $EDGE 2>/dev/null; pkill -f "bin/xray run" 2>/dev/null' EXIT
cd /home/z/my-project

echo "--- waiting for health ---"
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUB/api/auth/me" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "health: $code"
[ "$code" = "200" ] || { echo "FAIL: no health"; tail -30 /tmp/e2e-edge.log; exit 1; }

CJ=/tmp/e2e-cj.txt
echo "--- login ---"
curl -s -o /dev/null -w 'login:%{http_code}\n' -c "$CJ" -X POST "http://127.0.0.1:$PUB/api/auth/login" -H 'Content-Type: application/json' -d '{"password":"admin123"}'

echo "--- create user with URL-pasted panel address (the old broken flow) ---"
CREATE=$(curl -s -b "$CJ" -X POST "http://127.0.0.1:$PUB/api/admin/clients" -H 'Content-Type: application/json' \
  -d '{"name":"tunnel-test","trafficGb":5,"days":7,"protocol":"vless","address":"http://127.0.0.1:8091/","port":80,"tls":false}')
echo "$CREATE" | head -c 600; echo

PROXY_ID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.client?.proxies?.[0]?.id||'')})")
UUID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.client?.proxies?.[0]?.secret||'')})")
echo "proxy: $PROXY_ID uuid: $UUID"
[ -n "$UUID" ] || { echo "FAIL: no proxy created"; exit 1; }

echo "--- stored row (should be normalized, NOT contain http://) ---"
STORED=$(curl -s -b "$CJ" "http://127.0.0.1:$PUB/api/admin/clients")
echo "$STORED" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d)
  const c=j.clients.find(x=>x.name==='tunnel-test')
  const p=c.proxies[0]
  console.log('address:', p.address)
  console.log('port:', p.port, '| tls:', p.tls, '| transport:', p.transport, '| path:', p.path, '| host:', p.host, '| sni:', p.sni)
  if (p.address.includes('://')) { console.log('FAIL: address still contains scheme'); process.exit(1) }
  if (p.path !== '/vlessws') { console.log('FAIL: path is not /vlessws (builtin conversion missing)'); process.exit(1) }
  console.log('NORMALIZED-OK')
})"

echo "--- waiting for xray to pick up the new account ---"
xray_up=0
for i in $(seq 1 30); do
  if [ -f /tmp/xray/xray.pid ] && kill -0 "$(cat /tmp/xray/xray.pid 2>/dev/null)" 2>/dev/null; then xray_up=1; break; fi
  sleep 1
done
echo "xray running: $xray_up"
[ "$xray_up" = "1" ] || { echo "FAIL: xray not running"; cat /tmp/xray/xray.log 2>/dev/null | tail -20; exit 1; }
sleep 2

echo "--- raw vless-over-ws tunnel test (via edge router on :$PUB) ---"
node scripts/vless-client-test.cjs "ws://127.0.0.1:$PUB/vlessws" "$UUID" example.com 80
TUNNEL=$?

echo "--- direct xray test (bypass edge, :18091) ---"
node scripts/vless-client-test.cjs "ws://127.0.0.1:18091/vlessws" "$UUID" example.com 80 && echo "direct xray: OK" || echo "direct xray: FAIL"

echo "--- ws handshake probe via edge (HTTP 101 expected) ---"
curl -s -o /dev/null -w 'upgrade-status:%{http_code}\n' "http://127.0.0.1:$PUB/vlessws" \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' || true
echo "--- xray log tail ---"
tail -5 /tmp/xray/xray.log 2>/dev/null
echo "--- edge log tail ---"
tail -8 /tmp/e2e-edge.log 2>/dev/null

if [ "$TUNNEL" = "0" ]; then
  echo "=== LOCAL E2E PASSED ==="
  exit 0
fi
echo "=== LOCAL E2E FAILED ==="
exit 1
