#!/usr/bin/env node
/**
 * edge.js — the container's front router.
 *
 * One public port ($PORT) serves everything:
 *   HTTP                      → Next standalone (127.0.0.1:8081)
 *   WS upgrade /vlessws       → built-in xray backend (127.0.0.1:18081)
 *   WS upgrade (anything else)→ Next
 *
 * Also supervises the Next child process (restart on crash), so the panel
 * self-heals without a container restart. boot.sh runs this as PID 1.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'

const PUBLIC_PORT = Number(process.env.PORT || 8080)
const NEXT_PORT = Number(process.env.NEXT_PORT || 8081)
const XRAY_PORT = Number(process.env.XRAY_WS_PORT || 18081)
const XRAY_PATH = process.env.XRAY_WS_PATH || '/vlessws'
const NEXT_HOST = '127.0.0.1'
const XRAY_HOST = '127.0.0.1'

const log = (m) => console.log(`[edge] ${m}`)

// ── Next supervisor ──────────────────────────────────────────────────────────
let nextChild = null
let nextBackoff = 500

function startNext() {
  nextChild = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(NEXT_PORT), HOSTNAME: NEXT_HOST },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  log(`next standalone starting on ${NEXT_HOST}:${NEXT_PORT} (pid ${nextChild.pid})`)
  nextChild.on('exit', (code, sig) => {
    log(`next exited (code=${code} sig=${sig}) — restarting in ${nextBackoff}ms`)
    setTimeout(startNext, nextBackoff)
    nextBackoff = Math.min(nextBackoff * 2, 8000)
  })
  setTimeout(() => {
    nextBackoff = 500
  }, 15000)
}
startNext()

// ── xray watchdog (built-in backend) ──────────────────────────────────────
const XRAY_PID_FILE = '/tmp/xray/xray.pid'

function xrayAlive() {
  try {
    const pid = Number(readFileSync(XRAY_PID_FILE, 'utf8').trim())
    if (!pid) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function runSync() {
  const child = spawn(process.execPath, ['scripts/xray-sync.mjs'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  child.on('exit', (c) => log(`xray-sync finished (code=${c})`))
}

// initial start (writes config from DB + launches xray when accounts exist)
setTimeout(runSync, 1000)
// crash watchdog: if the pid disappears, resync (which restarts it)
setInterval(() => {
  if (!existsSync('/app/bin/xray') && !existsSync('bin/xray')) return
  if (!xrayAlive()) {
    log('xray not running — resyncing')
    runSync()
  }
}, 20000).unref()

// ── HTTP proxying (parsed requests → forward via http.request) ──────────────
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 })

function proxyHttp(req, res) {
  const proxyReq = http.request(
    {
      host: NEXT_HOST,
      port: NEXT_PORT,
      agent,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: req.headers.host || `localhost:${NEXT_PORT}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', (e) => {
    log(`upstream error: ${e.message}`)
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
    res.end('panel is warming up — try again in a moment')
  })
  req.pipe(proxyReq)
}

// ── raw WS piping ────────────────────────────────────────────────────────────
// Node has already CONSUMED the request head by the time 'upgrade' fires —
// the socket only carries bytes after the header block. Rebuild the request
// from rawHeaders so the upstream actually receives the upgrade request.
function pipeRaw(req, clientSock, head, targetPort, targetHost) {
  const lines = [`${req.method} ${req.url} HTTP/1.1`]
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
  }
  const requestHead = Buffer.from(lines.join('\r\n') + '\r\n\r\n')
  const upstream = net.connect(targetPort, targetHost, () => {
    upstream.write(requestHead)
    if (head?.length) upstream.write(head)
    clientSock.pipe(upstream)
    upstream.pipe(clientSock)
  })
  const kill = (why) => {
    if (why) log(`raw pipe to ${targetHost}:${targetPort} closed: ${why}`)
    clientSock.destroy()
    upstream.destroy()
  }
  clientSock.on('error', (e) => kill(`client error: ${e.message}`))
  upstream.on('error', (e) => kill(`upstream error: ${e.message}`))
  clientSock.on('close', () => kill())
  upstream.on('close', () => kill())
}

// ── public server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => proxyHttp(req, res))

server.on('upgrade', (req, socket, head) => {
  const path = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/'
  if (path === XRAY_PATH) {
    pipeRaw(req, socket, head, XRAY_PORT, XRAY_HOST)
  } else {
    // Next standalone handles its own upgrades (none expected in prod, but
    // forward the raw socket so nothing breaks)
    pipeRaw(req, socket, head, NEXT_PORT, NEXT_HOST)
  }
})

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  log(`public server on 0.0.0.0:${PUBLIC_PORT} → next:${NEXT_PORT} · xray-ws:${XRAY_PATH}`)
})

const shutdown = () => {
  log('shutting down')
  try {
    nextChild?.kill('SIGTERM')
  } catch {}
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
