#!/bin/bash
# Re-verify after the bidi fix: login → users (fa, desktop) → users (fa, mobile)
set -u
cd /home/z/my-project
SHOTS=tool-results/shots
mkdir -p "$SHOTS"

export NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 DATABASE_URL=file:/home/z/my-project/db/custom.db
node .next/standalone/server.js > server.log 2>&1 &
SRV=$!
sleep 4

if ! curl -s -o /dev/null http://localhost:8080/; then
  echo "SERVER FAILED"; tail -5 server.log; kill $SRV 2>/dev/null; exit 1
fi

ab() { agent-browser "$@" 2>&1 | tail -1; }

ab set viewport 1440 900
ab open http://localhost:8080
ab wait --load networkidle
sleep 1.5
ab find placeholder "••••••••" fill "admin123"
ab press Enter
ab wait --load networkidle
sleep 2

# users view (Persian desktop)
ab find text "کاربران" click
sleep 1.2
ab screenshot "$SHOTS/12-users-fa-fixed.png"

# nodes view (Persian desktop)
ab eval "document.querySelectorAll('aside button')[2].click()"
sleep 1.2
ab screenshot "$SHOTS/13-nodes-fa-fixed.png"

# scanner view (Persian desktop)
ab eval "document.querySelectorAll('aside button')[3].click()"
sleep 1.2
ab screenshot "$SHOTS/14-scanner-fa-fixed.png"

# mobile users
ab set viewport 390 844
ab reload
ab wait --load networkidle
sleep 2
ab eval "document.querySelectorAll('nav button')[1].click()"
sleep 1.2
ab screenshot "$SHOTS/15-users-fa-mobile-fixed.png"

ab close
kill $SRV 2>/dev/null
echo done
