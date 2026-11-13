'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, ExternalLink, RefreshCw, Server, ShieldCheck, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/lib/i18n'

function randomSecret() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function TelegramProxyView() {
  const { t } = useLang()
  const [host, setHost] = useState('')
  const [port, setPort] = useState('443')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)

  const clientSecret = secret ? `dd${secret}` : ''
  const link = useMemo(() => {
    if (!host.trim() || !clientSecret || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return ''
    return `https://t.me/proxy?server=${encodeURIComponent(host.trim())}&port=${port}&secret=${clientSecret}`
  }, [host, port, clientSecret])

  const installScript = useMemo(() => {
    if (!secret) return ''
    const safePort = /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535 ? Number(port) : 443
    return `#!/usr/bin/env bash
set -Eeuo pipefail

# Odyssey MTProto — official Telegram MTProxy source, Ubuntu/Debian
PORT=${safePort}
SECRET='${secret}'
WORKDIR=/opt/odyssey-mtproxy

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash install-mtproxy.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends git curl build-essential libssl-dev zlib1g-dev ca-certificates

install -d -o root -g root -m 0755 "$WORKDIR"
if [ ! -d "$WORKDIR/.git" ]; then
  git clone --depth 1 https://github.com/TelegramMessenger/MTProxy.git "$WORKDIR"
else
  git -C "$WORKDIR" fetch --depth 1 origin
  git -C "$WORKDIR" reset --hard FETCH_HEAD
fi

make -C "$WORKDIR"
install -m 0755 "$WORKDIR/objs/bin/mtproto-proxy" /usr/local/bin/mtproto-proxy
curl -fsSL https://core.telegram.org/getProxySecret -o "$WORKDIR/proxy-secret"
curl -fsSL https://core.telegram.org/getProxyConfig -o "$WORKDIR/proxy-multi.conf"
chmod 0644 "$WORKDIR/proxy-secret" "$WORKDIR/proxy-multi.conf"

# systemd starts as root so port 443 can be bound; MTProxy drops privileges to nobody via -u.
cat >/etc/systemd/system/odyssey-mtproxy.service <<UNIT
[Unit]
Description=Odyssey Telegram MTProto Proxy
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$WORKDIR
ExecStart=/usr/local/bin/mtproto-proxy -u nobody -p 8888 -H $PORT -S $SECRET --aes-pwd $WORKDIR/proxy-secret $WORKDIR/proxy-multi.conf -M 1
Restart=on-failure
RestartSec=5
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT

# Telegram recommends refreshing its server configuration periodically.
cat >/usr/local/sbin/odyssey-mtproxy-update-config <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail
curl -fsSL https://core.telegram.org/getProxyConfig -o /opt/odyssey-mtproxy/proxy-multi.conf.tmp
install -m 0644 /opt/odyssey-mtproxy/proxy-multi.conf.tmp /opt/odyssey-mtproxy/proxy-multi.conf
rm -f /opt/odyssey-mtproxy/proxy-multi.conf.tmp
systemctl try-restart odyssey-mtproxy.service
SCRIPT
chmod 0755 /usr/local/sbin/odyssey-mtproxy-update-config

cat >/etc/systemd/system/odyssey-mtproxy-update.service <<'UNIT'
[Unit]
Description=Refresh Telegram MTProxy server configuration

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/odyssey-mtproxy-update-config
UNIT

cat >/etc/systemd/system/odyssey-mtproxy-update.timer <<'UNIT'
[Unit]
Description=Daily Telegram MTProxy configuration refresh

[Timer]
OnCalendar=daily
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
UNIT

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT/tcp"
fi

systemctl daemon-reload
systemctl enable --now odyssey-mtproxy.service
systemctl enable --now odyssey-mtproxy-update.timer
sleep 2

echo
echo "=== Odyssey MTProxy status ==="
systemctl --no-pager --full status odyssey-mtproxy.service || true
if systemctl is-active --quiet odyssey-mtproxy.service; then
  echo "Service is active."
else
  echo "ERROR: service did not start. Inspect: journalctl -u odyssey-mtproxy -n 100 --no-pager"
  exit 1
fi

echo
echo "Client secret: dd${secret}"
echo "Listening TCP port: $PORT"
echo "IMPORTANT: also allow inbound TCP/$PORT in your VPS provider firewall/security list."
echo "Telegram link: https://t.me/proxy?server=YOUR_PUBLIC_IP_OR_DOMAIN&port=$PORT&secret=dd${secret}"
`
  }, [secret, port])

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('{label} copied', { label }))
    } catch {
      toast.error(t('Clipboard unavailable'))
    }
  }

  const generate = () => {
    setBusy(true)
    try { setSecret(randomSecret()) } finally { setBusy(false) }
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-odyssey-cyan/90">Telegram</span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{t('Telegram MTProto')}</h1>
          <p className="text-sm text-muted-foreground">{t('Create a real MTProto server installer and Telegram connection link.')}</p>
        </div>
        <ShieldCheck className="h-10 w-10 text-odyssey-cyan/70" />
      </div>

      <Card className="aurora-edge">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" />{t('Server details')}</CardTitle>
          <CardDescription>{t('You need an Ubuntu/Debian VPS with a public IP. This panel runs on Railway and cannot expose a raw MTProto TCP listener itself.')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="mtproxy-host">{t('VPS public IP or domain')}</Label>
            <Input id="mtproxy-host" dir="ltr" placeholder="203.0.113.10" value={host} onChange={(e) => setHost(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mtproxy-port">{t('Public TCP port')}</Label>
            <Input id="mtproxy-port" dir="ltr" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <Button onClick={generate} disabled={busy} className="gap-2"><RefreshCw className="h-4 w-4" />{t('Generate secret')}</Button>
        </CardContent>
      </Card>

      {secret && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{t('Connection details')}</CardTitle><CardDescription>{t('Keep this secret private. Anyone who has the link can use your proxy.')}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('MTProto secret (random padding)')}</Label>
                <div className="flex gap-2"><Input readOnly dir="ltr" value={clientSecret} className="font-mono text-xs" /><Button variant="outline" size="icon" onClick={() => void copy(clientSecret, t('Secret'))}><Copy className="h-4 w-4" /></Button></div>
              </div>
              <div className="space-y-2">
                <Label>{t('Telegram connection link')}</Label>
                <div className="flex gap-2"><Input readOnly dir="ltr" value={link || t('Enter a valid server address and port')} className="font-mono text-xs" /><Button variant="outline" size="icon" disabled={!link} onClick={() => void copy(link, t('Link'))}><Copy className="h-4 w-4" /></Button></div>
                {link && <Button asChild className="w-full sm:w-auto"><a href={link} target="_blank" rel="noreferrer"><ExternalLink className="me-2 h-4 w-4" />{t('Open in Telegram')}</a></Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4" />{t('One-time VPS installer')}</CardTitle><CardDescription>{t('Copy this script to your Ubuntu/Debian VPS. It builds Telegram’s official MTProxy source, installs a systemd service, and opens the selected TCP port in UFW if enabled.')}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border bg-muted/50 p-3">
                <pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed">{installScript}</pre>
              </div>
              <Button onClick={() => void copy(installScript, t('Installer script'))} className="gap-2"><Copy className="h-4 w-4" />{t('Copy installer script')}</Button>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-2 py-4 text-sm">
          <p className="font-semibold">{t('Important: what this does and does not do')}</p>
          <p className="text-muted-foreground">{t('The script must be run once on your own VPS as root. The VPS provider firewall/security group must also allow inbound TCP on the chosen port. The generated link becomes usable after the service is active; the panel does not pretend to deploy a proxy on Railway.')}</p>
          <p className="text-muted-foreground">{t('After installation, verify with: systemctl is-active odyssey-mtproxy')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
