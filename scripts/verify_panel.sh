#!/bin/bash
# One-shot visual verification: boots the production server, logs in,
# screenshots every view in fa/en × desktop/mobile, then stops the server.
set -u
cd /home/z/my-project
SHOTS=tool-results/shots
mkdir -p "$SHOTS"

export NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 DATABASE_URL=file:/home/z/my-project/db/custom.db
node .next/standalone/server.js > server.log 2>&1 &
SRV=$!
sleep 4

if ! curl -s -o /dev/null http://localhost:8080/; then
  echo "SERVER FAILED TO START"; tail -5 server.log; kill $SRV 2>/dev/null; exit 1
fi
echo "server up"

ab() { agent-browser "$@" 2>&1 | tail -1; }

# ---------- Desktop · Persian ----------
ab set viewport 1440 900
ab open http://localhost:8080
ab wait --load networkidle
sleep 1.5
ab screenshot "$SHOTS/01-login-fa-desktop.png"

# login
ab find placeholder "••••••••" fill "admin123"
ab press Enter
ab wait --load networkidle
sleep 2
ab screenshot "$SHOTS/02-dashboard-fa-desktop.png"

ab find text "کاربران" click
sleep 1.2
ab screenshot "$SHOTS/03-users-fa-desktop.png"

ab find text "نودها و ورکرها" click
sleep 1.2
ab screenshot "$SHOTS/04-nodes-fa-desktop.png"

ab find text "اسکنر" click
sleep 1.2
ab screenshot "$SHOTS/05-scanner-fa-desktop.png"

ab find text "تنظیمات" click
sleep 1.2
ab screenshot "$SHOTS/06-settings-fa-desktop.png"

# ---------- Desktop · English ----------
ab storage local set bashar.lang en
ab reload
ab wait --load networkidle
sleep 2
ab screenshot "$SHOTS/07-settings-en-desktop.png"

ab find text "Dashboard" click
sleep 1.2
ab screenshot "$SHOTS/08-dashboard-en-desktop.png"

# ---------- Mobile · Persian ----------
ab storage local set bashar.lang fa
ab set viewport 390 844
ab reload
ab wait --load networkidle
sleep 2
ab screenshot "$SHOTS/09-dashboard-fa-mobile.png"

ab find text "کاربران" click
sleep 1.2
ab screenshot "$SHOTS/10-users-fa-mobile.png"

ab find text "تنظیمات" click
sleep 1.2
ab screenshot "$SHOTS/11-settings-fa-mobile.png"

ab close
kill $SRV 2>/dev/null
echo "done"
