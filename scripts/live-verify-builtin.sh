#!/usr/bin/env bash
# Live verification of the built-in backend + normalization + migration.
set -u
BASE="https://odyssey-panel-production.up.railway.app"
ADMIN_PW="${ADMIN_PW:?set ADMIN_PW env var}"
CJ=/tmp/live2-cj.txt

echo "--- waiting for new deploy (edge marker: /vlessws responds) ---"
ready=0
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/auth/me" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then ready=1; echo "health 200 (attempt $i)"; break; fi
  sleep 10
done
[ "$ready" = "1" ] || { echo "FAIL: health never turned 200"; exit 1; }

pass=0; fail=0
ok () { echo "PASS: $1"; pass=$((pass+1)); }
no () { echo "FAIL: $1"; fail=$((fail+1)); }

echo "--- login ---"
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$CJ" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"password":""$ADMIN_PW""}')
echo "login: $code"
[ "$code" = "200" ] && ok "login" || no "login"

echo "--- Pouria's row migrated? ---"
MIG=$(curl -s -b "$CJ" "$BASE/api/admin/clients" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d)
  const c=(j.clients||[]).find(x=>x.name==='Pouria')
  if(!c){console.log('NOPOURIA');return}
  const p=c.proxies[0]
  if(!p){console.log('NOPROXY');return}
  console.log(JSON.stringify({addr:p.address,port:p.port,path:p.path,tls:p.tls,host:p.host,broken:/[:][\/][\/]/.test(p.address)}))
})")
echo "  $MIG"
echo "$MIG" | grep -q '"broken":false' && echo "$MIG" | grep -q '/vlessws' && ok "address migrated to built-in backend" || no "address migration ($MIG)"

echo "--- create zero-input user via builtin (UI flow simulation) ---"
CREATE=$(curl -s -b "$CJ" -X POST "$BASE/api/admin/clients" -H 'Content-Type: application/json' \
  -d '{"name":"zz-builtin-tmp","trafficGb":1,"days":1,"protocol":"vless","address":"https://odyssey-panel-production.up.railway.app/vlessws","port":443,"tls":true,"transport":"ws","path":"/vlessws"}')
TID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.client.id)}catch(e){console.log('')}})")
TUUID=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.client.proxies[0].secret)}catch(e){console.log('')}})")
TTOK=$(echo "$CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.client.subToken)}catch(e){console.log('')}})")
[ -n "$TUUID" ] && ok "created tmp account (uuid $TUUID)" || no "create tmp account"
echo "$CREATE" | grep -q 'https://' && no "stored address contains URL scheme" || ok "stored address is clean"

echo "--- subscription link format ---"
SUB=$(curl -s "$BASE/api/sub/$TTOK?format=raw")
echo "  $(echo "$SUB" | head -c 200)"
echo "$SUB" | grep -qE "^vless://[0-9a-f-]{36}@odyssey-panel-production\.up\.railway\.app:443\?type=ws&security=tls" && ok "vless URI points at panel domain" || no "vless URI format"
echo "$SUB" | grep -q "path=%2Fvlessws" && ok "ws path /vlessws in URI" || no "ws path"

echo "--- THE REAL TEST: tunnel through the live panel domain ---"
node /home/z/my-project/scripts/vless-client-test.cjs "wss://odyssey-panel-production.up.railway.app/vlessws" "$TUUID" example.com 80
[ $? = "0" ] && ok "LIVE TUNNEL WORKS (wss → internet)" || no "live tunnel"

echo "--- cleanup temp user ---"
curl -s -o /dev/null -b "$CJ" -X DELETE "$BASE/api/admin/clients/$TID" && ok "cleanup" || no "cleanup"

echo "=== LIVE RESULT: $pass passed, $fail failed ==="
[ "$fail" = "0" ]
