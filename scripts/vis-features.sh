#!/usr/bin/env bash
# Visual test: dashboard (RAM/protocols cards), anti-filter view, users view.
set -u
cd /home/z/my-project
DB=/tmp/e2e-feat.db          # reuse the seeded DB from e2e-features (user 'reza' + 8 protocols)
PORT=8092
export DATABASE_URL="file:$DB"
export PORT

mkdir -p /tmp/render
node .next/standalone/server.js > /tmp/vis-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; agent-browser close 2>/dev/null' EXIT

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/me" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "health: $code"

agent-browser set viewport 1440 900
agent-browser open "http://127.0.0.1:$PORT/" > /dev/null
agent-browser wait --load networkidle > /dev/null 2>&1

echo "--- login ---"
agent-browser find label "رمز مدیر" fill "admin123"
agent-browser find role button click --name "ورود"
sleep 2
agent-browser wait --load networkidle > /dev/null 2>&1

echo "--- dashboard checks ---"
agent-browser screenshot /tmp/render/vis-dash.png > /dev/null
SNAP=$(agent-browser snapshot 2>/dev/null)
echo "$SNAP" | grep -q "RAM" && echo "PASS: RAM card visible" || echo "FAIL: RAM card"
echo "$SNAP" | grep -q "پروتکل" && echo "PASS: protocols card visible" || echo "FAIL: protocols card"
echo "$SNAP" | grep -q "ضد فیلترینگ" && echo "PASS: anti-filter nav visible" || echo "FAIL: anti-filter nav"
if echo "$SNAP" | grep -q "رایگان"; then echo "FAIL: رایگان still visible"; else echo "PASS: no رایگان on dashboard"; fi
echo "$SNAP" | grep -q "حافظه" && echo "FAIL: حافظه still visible" || echo "PASS: no حافظه label"

echo "--- anti-filter view ---"
agent-browser find role button click --name "ضد فیلترینگ"
sleep 1.5
agent-browser screenshot /tmp/render/vis-antifilter.png > /dev/null
SNAP2=$(agent-browser snapshot 2>/dev/null)
for isp in "همراه اول" "ایرانسل" "رایتل" "شاتل" "فیبر نوری مخابرات" "ADSL مخابرات"; do
  echo "$SNAP2" | grep -q "$isp" && echo "PASS: ISP preset $isp" || echo "FAIL: ISP preset $isp"
done
echo "$SNAP2" | grep -q "فرگمنت چیست" && echo "PASS: fragment explainer" || echo "FAIL: fragment explainer"
echo "$SNAP2" | grep -q "نوع آدرس سرور" && echo "PASS: address helper" || echo "FAIL: address helper"
agent-browser find role button click --name "اعمال روی همه حساب‌ها" > /dev/null 2>&1 || echo "(apply-all click skipped)"
sleep 1

echo "--- users view ---"
agent-browser find role button click --name "کاربران"
sleep 1.5
agent-browser screenshot /tmp/render/vis-users.png > /dev/null
SNAP3=$(agent-browser snapshot 2>/dev/null)
echo "$SNAP3" | grep -q "Hiddify" && echo "PASS: one-tap import buttons in card row" || echo "WARN: deep links not in card (expected in dialog)"
echo "$SNAP3" | grep -qi "vless\|vmess\|t.me" && echo "PASS: config chip rendered" || echo "FAIL: config chip missing"

echo "--- open detail dialog ---"
agent-browser find role button click --name "مدیریت"
sleep 1.5
agent-browser screenshot /tmp/render/vis-dialog.png > /dev/null
SNAP4=$(agent-browser snapshot 2>/dev/null)
echo "$SNAP4" | grep -q "اتصال فوری" && echo "PASS: one-tap import in dialog" || echo "FAIL: one-tap import in dialog"
echo "$SNAP4" | grep -q "آدرس کانفیگ" && echo "PASS: config address section" || echo "FAIL: config address section"
echo "$SNAP4" | grep -q "باز کردن در تلگرام" && echo "PASS: telegram button" || echo "FAIL: telegram button"
GEO=$(agent-browser eval "JSON.stringify({sw:document.querySelector('[role=dialog]')?.scrollWidth, cw:document.querySelector('[role=dialog]')?.clientWidth})" 2>/dev/null)
echo "dialog geometry: $GEO"

echo "--- add-account dialog with ISP chips ---"
agent-browser find role button click --name "افزودن حساب" > /dev/null 2>&1
sleep 1
agent-browser snapshot -i 2>/dev/null | grep -q "همراه اول" && echo "PASS: ISP chips in add-account" || echo "WARN: ISP chips not visible (dialog maybe stacked)"

agent-browser close > /dev/null 2>&1
echo "DONE"
