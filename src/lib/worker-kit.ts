/**
 * Ready-to-deploy Cloudflare Worker that turns any *.workers.dev subdomain
 * into a vless-over-WebSocket endpoint (the classic "edgetunnel" pattern,
 * trimmed to the essentials). The panel's Worker kit page shows this code
 * with copy/paste instructions, so an admin who prefers the Iran-optimized
 * Cloudflare route can set it up in ~3 minutes.
 *
 * The worker accepts the UUID carried inside the vless header — i.e. the
 * same UUID the panel generates per account — so one deployment serves
 * every user of the panel.
 */
export const WORKER_CODE = `// Odyssey vless-over-WS worker — Cloudflare Workers (free plan OK)
// Deploy: dash.cloudflare.com → Workers & Pages → Create → paste this → Deploy
import { connect } from 'cloudflare:sockets';

const PROXY_IP = ''; // optional fallback proxy "ip:port" for sites CF can't reach

export default {
  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Odyssey tunnel is ready \\u2705', { status: 200 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    serve(server).catch(() => safeClose(server));
    return new Response(null, { status: 101, webSocket: client });
  },
};

function safeClose(ws) {
  try { ws.close(); } catch (_) {}
}

async function serve(ws) {
  let tcpSock = null;
  let writer = null;
  let headerSeen = false;

  const forward = async (chunk) => {
    const data = chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
      : chunk instanceof Uint8Array ? chunk
      : new Uint8Array(await new Response(chunk).arrayBuffer());
    if (writer && data.byteLength) await writer.write(data);
  };

  ws.addEventListener('message', async (event) => {
    try {
      if (!headerSeen) {
        headerSeen = true;
        const data = event.data instanceof ArrayBuffer ? new Uint8Array(event.data)
          : new Uint8Array(await new Response(event.data).arrayBuffer());
        if (data.byteLength < 26) return safeClose(ws);
        const addonsLen = data[17];
        const opt = 18 + addonsLen;
        const cmd = data[opt];
        const port = (data[opt + 1] << 8) | data[opt + 2];
        const atype = data[opt + 3];
        let addr = '';
        let offset = opt + 4;
        if (atype === 1) {
          addr = Array.from(data.slice(offset, offset + 4)).join('.');
          offset += 4;
        } else if (atype === 2) {
          const len = data[offset];
          addr = new TextDecoder().decode(data.slice(offset + 1, offset + 1 + len));
          offset += 1 + len;
        } else if (atype === 3) {
          const parts = [];
          for (let i = 0; i < 16; i += 2) {
            parts.push(((data[offset + i] << 8) | data[offset + i + 1]).toString(16));
          }
          addr = parts.join(':');
          offset += 16;
        } else {
          return safeClose(ws);
        }

        // acknowledge the vless handshake (version + empty addons)
        ws.send(new Uint8Array([data[0], 0]).buffer);

        if (cmd !== 1) {
          // UDP / mux commands are not supported — stay open but idle
          return;
        }

        const target = PROXY_IP && PROXY_IP.includes(':') ? PROXY_IP : addr + ':' + port;
        tcpSock = connect(target, { allowUntrusted: false });
        writer = tcpSock.writable.getWriter();

        const firstPayload = data.slice(offset);
        if (firstPayload.byteLength) await writer.write(firstPayload);

        (async () => {
          const reader = tcpSock.readable.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) return safeClose(ws);
            if (value && value.byteLength) ws.send(value);
          }
        })().catch(() => safeClose(ws));
        return;
      }
      await forward(event.data);
    } catch (_) {
      safeClose(ws);
    }
  });

  ws.addEventListener('close', () => { try { tcpSock?.close(); } catch (_) {} });
  ws.addEventListener('error', () => { try { tcpSock?.close(); } catch (_) {} });
}
`

export const WORKER_STEPS_FA = [
  'وارد Cloudflare شو (dash.cloudflare.com) و از منوی چپ «Workers & Pages» را بزن.',
  'روی «Create» و بعد «Create Worker» بزن؛ یک اسم بگذار (مثلاً odyssey) و Deploy کن.',
  '«Edit code» را بزن، همهٔ کد پیش‌فرض را پاک کن و کد بالا را Paste کن؛ سپس Deploy.',
  'آدرس https://<اسم-وردکر>.<یوزرنیم>.workers.dev را کپی کن و در همین صفحه به‌عنوان ورکر ثبتش کن.',
  'حالا در بخش کاربران، هنگام ساخت حساب، منبع را «ورکر کلادفلر» بگذار و همین ورکر را انتخاب کن.',
]
