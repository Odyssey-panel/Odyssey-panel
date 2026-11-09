#!/bin/bash
# Full simulation of the Odyssey Railway container boot — 3 scenarios:
#   A) fresh empty volume, working prisma CLI (what Railway does on a clean deploy)
#   B) volume with a broken/empty panel.db AND broken prisma CLI (worst case —
#      the exact state the user's Railway screenshots show)
#   C) volume with existing data (must NEVER be overwritten)
set -u
SIM=/tmp/sim
PROJ=/home/z/my-project
PASS=0; FAIL=0

say()  { echo -e "\n===== $* ====="; }
chk()  { if [ "$1" = "$2" ]; then echo "PASS: $3"; PASS=$((PASS+1)); else echo "FAIL: $3 (got '$1' want '$2')"; FAIL=$((FAIL+1)); fi; }
has()  { if echo "$1" | grep -q "$2"; then echo "PASS: contains '$2'"; PASS=$((PASS+1)); else echo "FAIL: missing '$2' in: $1"; FAIL=$((FAIL+1)); fi; }

say "0. layout: fake /app + baked template.db (mirrors Dockerfile)"
rm -rf $SIM && mkdir -p $SIM/app $SIM/bin $SIM/volA $SIM/volB $SIM/volC
cp -r $PROJ/.next/standalone/. $SIM/app/
mkdir -p $SIM/app/prisma $SIM/app/scripts
cp $PROJ/prisma/schema.prisma $PROJ/prisma/seed.boot.mjs $SIM/app/prisma/
cp $PROJ/scripts/boot.sh $PROJ/scripts/ensure-db.mjs $SIM/app/scripts/
# prisma CLI shim (in the real image: `npm i -g prisma@6.19.2`, same version)
printf '#!/bin/sh\nexec node %s/node_modules/prisma/build/index.js "$@"\n' "$PROJ" > $SIM/bin/prisma
chmod +x $SIM/bin/prisma
(cd $PROJ && DATABASE_URL=file:$SIM/template.db ./node_modules/.bin/prisma db push --skip-generate >/dev/null 2>&1) && rm -f $SIM/template.db-wal $SIM/template.db-shm
cp $SIM/template.db $SIM/app/prisma/template.db
CHK_T=$(node -e "const{PrismaClient}=require('$SIM/app/node_modules/@prisma/client');const p=new PrismaClient({datasources:{db:{url:'file:$SIM/template.db'}}});p.\$queryRawUnsafe('SELECT count(*) c FROM sqlite_master').then(r=>{console.log(r[0].c>=5?'tables-ok':'tables-missing');return p.\$disconnect()}).catch(e=>{console.log('ERR '+e.message);process.exit(1)})")
chk "$CHK_T" "tables-ok" "template.db has full schema"

wait_up() { # $1=port ; returns 0 when health endpoint answers 200
  for i in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/api/auth/me" 2>/dev/null)
    [ "$code" = "200" ] && return 0
    sleep 0.5
  done; return 1
}
login() { # $1=port -> echoes body, saves cookie to $SIM/cookie
  curl -s -c $SIM/cookie -X POST "http://127.0.0.1:$1/api/auth/login" \
    -H 'Content-Type: application/json' -d '{"password":"admin123"}'
}

say "A. fresh volume + working CLI (clean first deploy)"
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volA/panel.db PORT=8085 PATH="$SIM/bin:$PATH" \
  sh scripts/boot.sh > $SIM/bootA.log 2>&1 ) &
PID_A=$!
wait_up 8085; chk "$?" "0" "A: server healthy on /api/auth/me"
login 8085 > $SIM/loginA.json
chk "$(cat $SIM/loginA.json)" '{"ok":true}' "A: login admin123 -> ok"
grep -q panel_session $SIM/cookie && { echo "PASS: A: session cookie set"; PASS=$((PASS+1)); } || { echo "FAIL: A: no session cookie"; FAIL=$((FAIL+1)); }
has "$(cat $SIM/bootA.log)" "database schema verified" "A: schema verified by ensure-db"
has "$(cat $SIM/bootA.log)" "boot-seed" "A: seeder ran"
kill $PID_A 2>/dev/null; sleep 1

say "B. broken volume (0-byte panel.db) + BROKEN CLI — worst case, mirrors current Railway state"
: > $SIM/volB/panel.db
NODE_DIR=$(dirname "$(which node)")
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volB/panel.db PORT=8086 PATH="$NODE_DIR:/usr/bin:/bin" \
  sh scripts/boot.sh > $SIM/bootB.log 2>&1 ) &
PID_B=$!
wait_up 8086; chk "$?" "0" "B: server healthy despite broken CLI"
has "$(cat $SIM/bootB.log)" "restoring from baked-in template" "B: template fallback triggered"
has "$(cat $SIM/bootB.log)" "schema restored from template" "B: schema restored OK"
login 8086 > $SIM/loginB.json
chk "$(cat $SIM/loginB.json)" '{"ok":true}' "B: login admin123 -> ok"
kill $PID_B 2>/dev/null; sleep 1

say "C. existing data must survive (no template overwrite)"
cp $SIM/volA/panel.db $SIM/volC/panel.db
MARK=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.setting.create({data:{key:'user-data-marker',value:'precious'}}).then(async()=>{console.log('marker-added');await p.\$disconnect()}).catch(e=>{console.log('ERR '+e.message)})")
chk "$MARK" "marker-added" "C: marker row inserted"
OUT_C=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db PATH="$SIM/bin:$PATH" node scripts/ensure-db.mjs 2>&1)
has "$OUT_C" "all panel tables present" "C: ensure-db did NOT touch healthy db"
MARK2=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.setting.findUnique({where:{key:'user-data-marker'}}).then(async r=>{console.log(r?'marker-intact':'marker-LOST');await p.\$disconnect()})")
chk "$MARK2" "marker-intact" "C: user data preserved"

say "RESULT: $PASS passed / $FAIL failed"
[ "$FAIL" = "0" ]
