#!/usr/bin/env bash
# Live deploy verification: wait for the new build, then e2e on production.
set -u
BASE="https://odyssey-panel-production.up.railway.app"
CJ=/tmp/live-cj.txt

echo "--- waiting for new deploy (chunk marker: ضد فیلترینگ) ---"
found=0
for i in $(seq 1 60); do
  HTML=$(curl -s --max-time 15 "$BASE/" 2>/dev/null || true)
  CHUNKS=$(echo "$HTML" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u | head -12)
  for c in $CHUNKS; do
    if curl -s --max-time 15 "$BASE$c" 2>/dev/null | grep -q 'ضد فیلترینگ'; then
      found=1; echo "marker found in $c (attempt $i)"; break
    fi
  done
  [ "$found" = "1" ] && break
  sleep 15
done
[ "$found" = "1" ] || { echo "FAIL: deploy marker not found in time"; exit 1; }

echo "--- live login ---"
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$CJ" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"password":"admin123"}')
echo "login: $code"
[ "$code" = "200" ] || { echo "FAIL: live login"; exit 1; }

pass=0; fail=0
ok () { echo "PASS: $1"; pass=$((pass+1)); }
no () { echo "FAIL: $1"; fail=$((fail+1)); }

echo "--- live stats (system RAM) ---"
curl -s -b "$CJ" "$BASE/api/admin/stats" > /tmp/live-stats.json
node -e "
const s = require('/tmp/live-stats.json')
console.log(s.system && s.system.ramTotal > 0 ? 'RAM-OK ' + Math.round(s.system.ramUsed/1024/1024) + 'MB/' + Math.round(s.system.ramTotal/1024/1024) + 'MB ' + s.system.ramPct + '%' : 'RAM-BAD')
console.log('protocols:', JSON.stringify(s.protocols || {}))
" | grep -q "RAM-OK" && ok "live RAM stats" || no "live RAM stats"

echo "--- live create temp user with vless+fragment ---"
CREATE=$(curl -s -b "$CJ" -X POST "$BASE/api/admin/clients" -H 'Content-Type: application/json' \
  -d '{"name":"zz-e2e-tmp","trafficGb":1,"days":1,"protocol":"vless","address":"2001:db8::1","port":443,"sni":"www.speedtest.net","transport":"ws","tls":true,"fragment":"100-200,10-20,tlshello"}')
TID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).client.id)}catch(e){console.log('')}})")
TTOK=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).client.subToken)}catch(e){console.log('')}})")
echo "temp user: $TID"
if [ -n "$TID" ]; then ok "live create with fragment+IPv6"; else no "live create"; fi

echo "--- live add mtproto + hysteria2 ---"
curl -s -b "$CJ" -X POST "$BASE/api/admin/clients/$TID/proxies" -H 'Content-Type: application/json' \
  -d '{"protocol":"mtproto","address":"10.20.30.40","port":443,"sni":"speedtest.net"}' > /dev/null
curl -s -b "$CJ" -X POST "$BASE/api/admin/clients/$TID/proxies" -H 'Content-Type: application/json' \
  -d '{"protocol":"hysteria2","address":"hy.example.com","port":8443,"sni":"hy.example.com"}' > /dev/null

curl -s "$BASE/api/sub/$TTOK?format=raw" > /tmp/live-raw.txt
grep -q "fragment=100-200,10-20,tlshello" /tmp/live-raw.txt && ok "live fragment in link" || no "live fragment"
grep -q "\[2001:db8::1\]:443" /tmp/live-raw.txt && ok "live IPv6 bracket" || no "live IPv6"
grep -qE "^hysteria2://" /tmp/live-raw.txt && ok "live hysteria2" || no "live hysteria2"
grep -q "https://t.me/proxy?server=10.20.30.40&port=443&secret=dd" /tmp/live-raw.txt && ok "live mtproto" || no "live mtproto"

echo "--- cleanup temp user ---"
curl -s -b "$CJ" -X DELETE "$BASE/api/admin/clients/$TID" > /dev/null && ok "cleanup temp user" || no "cleanup"
curl -s "$BASE/api/sub/$TTOK?format=raw" | head -c 40; echo " (should be not found)"

echo "=== LIVE RESULT: $pass passed, $fail failed ==="
[ "$fail" = "0" ]
