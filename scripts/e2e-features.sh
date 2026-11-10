#!/usr/bin/env bash
# E2E test: new protocols (hysteria2/tuic/mtproto), fragment, IPv6 bracketing,
# apply-all bulk fragment, system stats (RAM) and ispPresets settings.
set -u
cd /home/z/my-project
DB=/tmp/e2e-feat.db
PORT=8092
rm -f "$DB" "$DB-"* /tmp/e2e-feat-cj.txt
export DATABASE_URL="file:$DB"
export PORT

node scripts/ensure-db.mjs
node prisma/seed.boot.mjs

node .next/standalone/server.js > /tmp/e2e-feat-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/me" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "health: $code"

CJ=/tmp/e2e-feat-cj.txt
curl -s -c "$CJ" -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' -d '{"password":"admin123"}' > /dev/null

pass=0; fail=0
check () { # $1 label, $2 haystack-file, $3 needle
  if grep -qF -- "$3" "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 (missing: $3)"; fail=$((fail+1)); fi
}

echo "--- create user with vless + fragment (MCI preset) ---"
CREATE=$(curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients" \
  -H 'Content-Type: application/json' \
  -d '{"name":"reza","trafficGb":0,"days":0,"protocol":"vless","address":"vps.example.com","port":443,"sni":"www.speedtest.net","transport":"ws","path":"/ws","tls":true,"fragment":"100-200,10-20,tlshello"}')
CID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).client.id))")
TOKEN=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).client.subToken))")
echo "client: $CID token: $TOKEN"

add () { # protocol, address, port, extra-json
  local extra="${4:-}"
  local body="{\"protocol\":\"$1\",\"address\":\"$2\",\"port\":$3,\"remark\":\"p-$1\"${extra:+,$extra}}"
  curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/clients/$CID/proxies" \
    -H 'Content-Type: application/json' -d "$body" > /dev/null
}
echo "--- add all protocols ---"
add vmess      "5.6.7.8"        443 '"sni":"cdn.example.com"'
add trojan     "vps.example.com" 443 '"sni":"vps.example.com","fragment":"50-100,10-20,1-3"'
add shadowsocks "9.9.9.9"       8388 ''
add hysteria2  "hy.example.com"  8443 '"sni":"hy.example.com"'
add tuic       "tu.example.com"  443 '"sni":"tu.example.com"'
add mtproto    "10.20.30.40"      443 '"sni":"speedtest.net"'

echo "--- IPv6 proxy (vless) ---"
add vless "2001:db8::1" 443 '"sni":"v6.example.com","fragment":"10-50,10-20,tlshello","remark":"p-v6"'

echo "--- sub raw: verify every scheme ---"
curl -s "http://127.0.0.1:$PORT/api/sub/$TOKEN?format=raw" > /tmp/feat-raw.txt
wc -l /tmp/feat-raw.txt
check "vless link"              /tmp/feat-raw.txt "vless://"
check "fragment in vless link"  /tmp/feat-raw.txt "fragment=100-200,10-20,tlshello"
check "vmess link"              /tmp/feat-raw.txt "vmess://"
check "trojan link + fragment"  /tmp/feat-raw.txt "trojan://"
check "trojan tcp fragment"     /tmp/feat-raw.txt "fragment=50-100,10-20,1-3"
grep -qE '^ss://' /tmp/feat-raw.txt && { echo "PASS: ss link"; pass=$((pass+1)); } || { echo "FAIL: ss link"; fail=$((fail+1)); }
check "hysteria2 link"          /tmp/feat-raw.txt "hysteria2://"
check "tuic link"               /tmp/feat-raw.txt "tuic://"
check "telegram t.me link"      /tmp/feat-raw.txt "https://t.me/proxy?server=10.20.30.40&port=443&secret=dd"
check "IPv6 brackets"           /tmp/feat-raw.txt "[2001:db8::1]:443"

echo "--- base64 sub parses and contains the same links ---"
curl -s "http://127.0.0.1:$PORT/api/sub/$TOKEN" | base64 -d > /tmp/feat-b64.txt
check "b64 vless"    /tmp/feat-b64.txt "vless://"
check "b64 t.me"     /tmp/feat-b64.txt "https://t.me/proxy"

echo "--- singbox sub includes hysteria2/tuic ---"
curl -s "http://127.0.0.1:$PORT/api/sub/$TOKEN?format=singbox" > /tmp/feat-sb.json
check "sb hysteria2" /tmp/feat-sb.json '"type": "hysteria2"'
check "sb tuic"      /tmp/feat-sb.json '"type": "tuic"'

echo "--- mtproto secret shape ---"
curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/clients/$CID" > /tmp/feat-client.json
node -e "
const c = require('/tmp/feat-client.json').client
const mt = c.proxies.find(p => p.protocol === 'mtproto')
const tu = c.proxies.find(p => p.protocol === 'tuic')
const okMt = /^dd[0-9a-f]{32}$/.test(mt.secret)
const okTu = /^[0-9a-f-]{36}:[A-Za-z0-9_-]+$/.test(tu.secret)
console.log(okMt ? 'PASS: mtproto secret dd+32hex' : 'FAIL: mtproto secret shape: ' + mt.secret)
console.log(okTu ? 'PASS: tuic secret uuid:password' : 'FAIL: tuic secret shape: ' + tu.secret)
const fr = c.proxies.find(p => p.remark === 'p-v6')
console.log(fr && fr.fragment === '10-50,10-20,tlshello' ? 'PASS: v6 proxy stored fragment' : 'FAIL: v6 fragment missing')
process.exit(okMt && okTu ? 0 : 1)
" && pass=$((pass+3)) || fail=$((fail+1))

echo "--- apply-all bulk fragment ---"
APPLY=$(curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/proxies/apply-all" \
  -H 'Content-Type: application/json' -d '{"fragment":"100-200,20-30,tlshello","protocol":"vless"}')
echo "$APPLY"
echo "$APPLY" | grep -q '"updated":2' && { echo "PASS: apply-all updated 2 vless"; pass=$((pass+1)); } || { echo "FAIL: apply-all count"; fail=$((fail+1)); }
curl -s -b "$CJ" -X POST "http://127.0.0.1:$PORT/api/admin/proxies/apply-all" -H 'Content-Type: application/json' -d '{"fragment":"bogus!!"}' | grep -q 'Invalid fragment' && { echo "PASS: fragment validation"; pass=$((pass+1)); } || { echo "FAIL: fragment validation"; fail=$((fail+1)); }

echo "--- stats: RAM + protocols ---"
curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/stats" > /tmp/feat-stats.json
node -e "
const s = require('/tmp/feat-stats.json')
const okRam = s.system && s.system.ramTotal > 0 && s.system.ramPct >= 0 && s.system.ramPct <= 100
const okProto = s.protocols && s.protocols.vless === 2 && s.protocols.mtproto === 1 && s.protocols.hysteria2 === 1 && s.protocols.tuic === 1
console.log(okRam ? 'PASS: system RAM stats' : 'FAIL: system RAM: ' + JSON.stringify(s.system))
console.log(okProto ? 'PASS: protocol breakdown' : 'FAIL: protocols: ' + JSON.stringify(s.protocols))
process.exit(okRam && okProto ? 0 : 1)
" && pass=$((pass+2)) || fail=$((fail+2))

echo "--- settings: ispPresets ---"
curl -s -b "$CJ" -X PUT "http://127.0.0.1:$PORT/api/admin/settings" \
  -H 'Content-Type: application/json' \
  -d '{"ispPresets":"{\"mci\":{\"length\":\"100-400\"}}"}' > /dev/null
curl -s -b "$CJ" "http://127.0.0.1:$PORT/api/admin/settings" > /tmp/feat-settings.json
node -e "
const s = require('/tmp/feat-settings.json')
const v = JSON.parse(s.settings.ispPresets || '{}')
console.log(v.mci && v.mci.length === '100-400' ? 'PASS: ispPresets stored' : 'FAIL: ispPresets: ' + s.settings.ispPresets)
process.exit(v.mci ? 0 : 1)
" && pass=$((pass+1)) || fail=$((fail+1))
curl -s -b "$CJ" -X PUT "http://127.0.0.1:$PORT/api/admin/settings" -H 'Content-Type: application/json' -d '{"ispPresets":"not-json"}' | grep -q 'valid JSON' && { echo "PASS: ispPresets validation"; pass=$((pass+1)); } || { echo "FAIL: ispPresets validation"; fail=$((fail+1)); }

echo "--- UI page + chunk marker ---"
HTML=$(curl -s "http://127.0.0.1:$PORT/")
echo "$HTML" | grep -q 'اودیسه' && { echo "PASS: app shell serves"; pass=$((pass+1)); } || { echo "FAIL: app shell"; fail=$((fail+1)); }

echo ""
echo "=== RESULT: $pass passed, $fail failed ==="
[ "$fail" = "0" ]
