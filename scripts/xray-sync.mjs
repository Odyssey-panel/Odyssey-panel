#!/usr/bin/env node
/**
 * xray-sync — regenerate the built-in backend config from the panel DB and
 * (re)start the xray process. Safe to call repeatedly: from boot.sh, and
 * fire-and-forget from admin API routes after client/proxy mutations.
 *
 * Layout:
 *   /tmp/xray/config.json   generated config
 *   /tmp/xray/xray.pid      running process id
 *   /tmp/xray/xray.log      process stdout/stderr
 *
 * Inbound: vless over ws on 127.0.0.1:18081, path /vlessws — fronted by
 * scripts/edge.js on the panel's own HTTPS domain. Clients mirror every
 * vless proxy row in the DB, so a generated config "just works".
 */
import { PrismaClient } from '@prisma/client'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'

const WORK = '/tmp/xray'
const BIN = process.env.XRAY_BIN || '/app/bin/xray'
const PORT = Number(process.env.XRAY_WS_PORT || 18081)
const WS_PATH = process.env.XRAY_WS_PATH || '/vlessws'

const db = new PrismaClient()

function log(msg) {
  console.log(`[xray-sync] ${msg}`)
}

function buildConfig(proxies) {
  const clients = proxies.map((p) => ({
    id: p.secret,
    email: p.id,
    level: 0,
  }))
  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'vless-ws-in',
        listen: '127.0.0.1',
        port: PORT,
        protocol: 'vless',
        settings: {
          clients,
          decryption: 'none',
        },
        streamSettings: {
          sockopt: { tcpFastOpen: true },
          network: 'ws',
          security: 'none',
          wsSettings: { path: WS_PATH, headers: {} },
        },
      },
    ],
    outbounds: [
      { tag: 'direct', protocol: 'freedom', settings: { domainStrategy: 'UseIP' } },
      { tag: 'block', protocol: 'blackhole', settings: { response: { type: 'none' } } },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        // keep the panel's own admin surface out of the tunnel
        { type: 'field', inboundTag: ['vless-ws-in'], outboundTag: 'direct' },
      ],
    },
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function stopOld() {
  const pidFile = path.join(WORK, 'xray.pid')
  try {
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, 'utf8').trim())
      if (pid && pidAlive(pid)) {
        try {
          execSync(`pkill -TERM -P ${pid} 2>/dev/null || true`)
          process.kill(pid, 'SIGTERM')
          log(`stopped previous xray (pid ${pid})`)
        } catch {
          /* already gone */
        }
      }
      rmSync(pidFile, { force: true })
    }
  } catch {
    /* best effort */
  }
}

function start(configPath) {
  if (!existsSync(BIN)) {
    log(`xray binary not found at ${BIN} — built-in backend disabled`)
    return false
  }
  const out = openSync(path.join(WORK, 'xray.log'), 'a', 0o600)
  const child = spawn(BIN, ['run', '-c', configPath], {
    detached: true,
    stdio: ['ignore', out, out],
    cwd: WORK,
  })
  child.unref()
  writeFileSync(path.join(WORK, 'xray.pid'), String(child.pid), { mode: 0o600 })
  log(`started xray (pid ${child.pid}) on 127.0.0.1:${PORT}${WS_PATH}`)
  return true
}

async function main() {
  mkdirSync(WORK, { recursive: true, mode: 0o700 })
  // This file contains every subscriber UUID. Keep credentials private even
  // if the container later gains additional unprivileged processes.
  try { chmodSync(WORK, 0o700) } catch {}

  const proxies = await db.proxy.findMany({
    where: { protocol: 'vless' },
    select: { id: true, secret: true },
  })
  const config = buildConfig(proxies)
  const configPath = path.join(WORK, 'config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  log(`config written — ${proxies.length} vless client(s)`)

  const onlyConfig = process.argv.includes('--config-only')
  if (onlyConfig) return

  stopOld()

  if (proxies.length === 0) {
    log('no vless accounts yet — backend idle (will start on first account)')
    return
  }
  start(configPath)
}

main()
  .catch((e) => {
    console.error('[xray-sync] failed:', e?.message || e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
