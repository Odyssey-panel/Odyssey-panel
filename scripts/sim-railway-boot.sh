#!/bin/bash
# Full simulation of the Odyssey Railway container boot — scenarios:
#   A) fresh empty volume (clean deploy) — seeds from the repo-baked db,
#      real admin password works, old default does NOT
#   B1) volume with a 0-byte panel.db + broken prisma CLI — repo db seed rescues it
#   B2) volume with garbage panel.db + broken CLI — template fallback restores schema
#   C) volume with existing data (must NEVER be overwritten)
#   D) user mistakes in the DATABASE_URL variable (the exact Railway incidents)
set -u
SIM=/tmp/sim
PROJ=/home/z/my-project
PASS=0; FAIL=0
REAL_PW='Ody-nnEEZ-YJsmc-EAMF5'

say()  { echo -e "\n===== $* ====="; }
chk()  { if [ "$1" = "$2" ]; then echo "PASS: $3"; PASS=$((PASS+1)); else echo "FAIL: $3 (got '$1' want '$2')"; FAIL=$((FAIL+1)); fi; }
has()  { if echo "$1" | grep -q "$2"; then echo "PASS: contains '$2'"; PASS=$((PASS+1)); else echo "FAIL: missing '$2' in: $1"; FAIL=$((FAIL+1)); fi; }

say "0. layout: fake /app + baked template.db + baked repo db (mirrors Dockerfile)"
rm -rf $SIM && mkdir -p $SIM/app $SIM/bin $SIM/volA $SIM/volB $SIM/volC
cp -r $PROJ/.next/standalone/. $SIM/app/
mkdir -p $SIM/app/prisma $SIM/app/scripts
cp $PROJ/prisma/schema.prisma $PROJ/prisma/seed.boot.mjs $SIM/app/prisma/
cp $PROJ/scripts/boot.sh $PROJ/scripts/ensure-db.mjs $PROJ/scripts/edge.js \
   $PROJ/scripts/migrate-addresses.mjs $PROJ/scripts/migrate-remarks.mjs \
   $PROJ/scripts/xray-sync.mjs $SIM/app/scripts/
cp -r $PROJ/db $SIM/app/db
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
login() { # $1=port $2=password -> echoes body, saves cookie to $SIM/cookie
  curl -s -c $SIM/cookie -X POST "http://127.0.0.1:$1/api/auth/login" \
    -H 'Content-Type: application/json' -d "{\"password\":\"$2\"}"
}

say "A. fresh volume + working CLI (clean first deploy)"
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volA/panel.db PORT=8085 PATH="$SIM/bin:$PATH" \
  sh scripts/boot.sh > $SIM/bootA.log 2>&1 ) &
PID_A=$!
wait_up 8085; chk "$?" "0" "A: server healthy on /api/auth/me"
login 8085 "$REAL_PW" > $SIM/loginA.json
chk "$(cat $SIM/loginA.json)" '{"ok":true}' "A: login with the real admin password -> ok"
login 8085 'admin123' > $SIM/loginA2.json
chk "$(cat $SIM/loginA2.json)" '{"error":"Wrong password"}' "A: old default password rejected"
has "$(cat $SIM/bootA.log)" "first boot" "A: repo db seed triggered"
has "$(cat $SIM/bootA.log)" "database schema verified" "A: schema verified by ensure-db"
LOC=$(DATABASE_URL=file:$SIM/volA/panel.db node -e "const{PrismaClient}=require('$SIM/app/node_modules/@prisma/client');const p=new PrismaClient();p.node.findFirst().then(n=>{console.log(n?n.location:'no-node');return p.\$disconnect()}).catch(e=>console.log('ERR'))")
chk "$LOC" "Singapore" "A: example node location = Singapore"
kill $PID_A 2>/dev/null; sleep 1

say "B1. 0-byte panel.db + BROKEN CLI — repo db seed must rescue the boot"
: > $SIM/volB/panel.db
NODE_DIR=$(dirname "$(which node)")
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volB/panel.db PORT=8086 PATH="$NODE_DIR:/usr/bin:/bin" \
  sh scripts/boot.sh > $SIM/bootB.log 2>&1 ) &
PID_B=$!
wait_up 8086; chk "$?" "0" "B1: server healthy despite broken CLI"
has "$(cat $SIM/bootB.log)" "first boot" "B1: repo db seed triggered on empty volume"
login 8086 "$REAL_PW" > $SIM/loginB.json
chk "$(cat $SIM/loginB.json)" '{"ok":true}' "B1: login with the real admin password -> ok"
kill $PID_B 2>/dev/null; sleep 1

say "B2. garbage (non-empty) panel.db + BROKEN CLI — template fallback path"
head -c 512 /dev/urandom > $SIM/volB/panel.db
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volB/panel.db PORT=8086 PATH="$NODE_DIR:/usr/bin:/bin" \
  sh scripts/boot.sh > $SIM/bootB2.log 2>&1 ) &
PID_B2=$!
wait_up 8086; chk "$?" "0" "B2: server healthy on garbage db"
has "$(cat $SIM/bootB2.log)" "schema restored from template" "B2: template fallback triggered"
kill $PID_B2 2>/dev/null; sleep 1

say "C. existing data must survive (no template overwrite)"
cp $SIM/volA/panel.db $SIM/volC/panel.db
MARK=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.setting.create({data:{key:'user-data-marker',value:'precious'}}).then(async()=>{console.log('marker-added');await p.\$disconnect()}).catch(e=>{console.log('ERR '+e.message)})")
chk "$MARK" "marker-added" "C: marker row inserted"
OUT_C=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db PATH="$SIM/bin:$PATH" node scripts/ensure-db.mjs 2>&1)
has "$OUT_C" "all panel tables present" "C: ensure-db did NOT touch healthy db"
MARK2=$(cd $SIM/app && DATABASE_URL=file:$SIM/volC/panel.db node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.setting.findUnique({where:{key:'user-data-marker'}}).then(async r=>{console.log(r?'marker-intact':'marker-LOST');await p.\$disconnect()})")
chk "$MARK2" "marker-intact" "C: user data preserved"

say "D. user mistake: DATABASE_URL set to a plain path in Variables tab (exact Railway incident)"
mkdir -p $SIM/volD $SIM/volD2
# D1: variable value like `data/` (no file: prefix) — must be auto-corrected
( cd $SIM/app && exec env DATABASE_URL=data/ ODYSSEY_DEFAULT_DB=file:$SIM/volD/panel.db PORT=8087 PATH="$SIM/bin:$PATH" \
  sh scripts/boot.sh > $SIM/bootD1.log 2>&1 ) &
PID_D1=$!
wait_up 8087; chk "$?" "0" "D1: server healthy with invalid DATABASE_URL=data/"
login 8087 "$REAL_PW" > $SIM/loginD1.json
chk "$(cat $SIM/loginD1.json)" '{"ok":true}' "D1: login with the real admin password -> ok"
has "$(cat $SIM/bootD1.log)" "must start with 'file:'" "D1: loud warning printed"
kill $PID_D1 2>/dev/null; sleep 1
# D2: file: URL pointing at a directory — must gain /panel.db
( cd $SIM/app && exec env DATABASE_URL=file:$SIM/volD2 PORT=8088 PATH="$SIM/bin:$PATH" \
  sh scripts/boot.sh > $SIM/bootD2.log 2>&1 ) &
PID_D2=$!
wait_up 8088; chk "$?" "0" "D2: server healthy with DATABASE_URL=file:<dir>"
login 8088 "$REAL_PW" > $SIM/loginD2.json
chk "$(cat $SIM/loginD2.json)" '{"ok":true}' "D2: login with the real admin password -> ok"
has "$(cat $SIM/bootD2.log)" "points at a directory" "D2: directory note printed"
[ -f $SIM/volD2/panel.db ] && { echo "PASS: D2: db file created inside dir"; PASS=$((PASS+1)); } || { echo "FAIL: D2: no db file in dir"; FAIL=$((FAIL+1)); }
kill $PID_D2 2>/dev/null; sleep 1

say "RESULT: $PASS passed / $FAIL failed"
[ "$FAIL" = "0" ]
