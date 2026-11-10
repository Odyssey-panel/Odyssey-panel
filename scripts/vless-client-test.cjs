#!/usr/bin/env node
/**
 * Raw vless-over-WebSocket client — proves the built-in backend actually
 * carries traffic end-to-end (no VPN app needed):
 *   ws connect → vless header (uuid + addr) → payload → response bytes
 */
const WebSocket = require('ws')

const url = process.argv[2] // ws://127.0.0.1:8091/vlessws or wss://domain/vlessws
const uuid = process.argv[3]
const targetHost = process.argv[4] || 'example.com'
const targetPort = Number(process.argv[5] || 80)
const request = process.argv[6] || `GET / HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: odyssey-e2e\r\nConnection: close\r\n\r\n`

function uuidBytes(id) {
  const hex = id.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function buildVlessRequest(uuidStr) {
  const id = uuidBytes(uuidStr)
  const addr = new TextEncoder().encode(targetHost)
  const payload = new TextEncoder().encode(request)
  const head = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + addr.length)
  let o = 0
  head[o++] = 0 // version
  head.set(id, o); o += 16
  head[o++] = 0 // addons length
  head[o++] = 1 // command: tcp
  head[o++] = (targetPort >> 8) & 0xff
  head[o++] = targetPort & 0xff
  head[o++] = 2 // atype: domain
  head[o++] = addr.length // domain length prefix
  head.set(addr, o)
  const all = new Uint8Array(head.length + payload.length)
  all.set(head, 0)
  all.set(payload, head.length)
  return all
}

const ws = new WebSocket(url, { perMessageDeflate: false })
const started = Date.now()
let done = false

const fail = (msg) => {
  if (done) return
  done = true
  console.error('VLESS-E2E-FAIL:', msg)
  process.exit(1)
}

const timer = setTimeout(() => fail(`timeout after ${Date.now() - started}ms`), 25000)

ws.on('open', () => {
  ws.send(buildVlessRequest(uuid).buffer, { binary: true })
})

let buf = Buffer.alloc(0)
let headerSkipped = false

ws.on('message', (data, isBinary) => {
  if (!isBinary) return fail('got text frame, expected binary')
  buf = Buffer.concat([buf, Buffer.from(data)])
  if (!headerSkipped) {
    if (buf.length < 2) return
    // server reply: [version, addonLen] — the panel's xray replies version 0
    const addonLen = buf[1]
    if (buf.length < 2 + addonLen) return
    buf = buf.slice(2 + addonLen)
    headerSkipped = true
  }
  if (buf.length > 0) {
    const text = buf.toString('latin1')
    if (/HTTP\/1\.[01] \d{3}/.test(text)) {
      const status = text.match(/HTTP\/1\.[01] (\d{3})/)[1]
      console.log(`VLESS-E2E-OK: tunneled HTTP status ${status} in ${Date.now() - started}ms, ${buf.length} bytes`)
      console.log(text.slice(0, 160).replace(/\r\n/g, ' | '))
      done = true
      clearTimeout(timer)
      ws.close()
      process.exit(0)
    }
  }
})

ws.on('error', (e) => fail(`ws error: ${e.message}`))
ws.on('close', (c) => {
  if (!done) fail(`ws closed early (code ${c})`)
})
