/**
 * Builders for proxy share links (vless/vmess/trojan/shadowsocks/hysteria2/
 * tuic/mtproto-telegram), server-side inbound configs (xray / sing-box
 * compatible) and subscription payloads (base64 / clash / sing-box).
 *
 * Everything here is isomorphic (runs on the server AND in the browser):
 * base64 uses btoa+TextEncoder when available and falls back to Buffer.
 */

export type ProxyLike = {
  protocol: string
  remark: string
  address: string
  port: number
  secret: string
  sni?: string | null
  host?: string | null
  path?: string | null
  transport?: string | null
  tls?: boolean | null
  flow?: string | null
  /** TLS-fragment string in Marzban order: "<length>,<interval>,<packets>" e.g. "100-200,20-30,tlshello" */
  fragment?: string | null
}

/** All protocols the panel can generate accounts/links for. */
export const PROTOCOL_LIST = [
  'vless',
  'vmess',
  'trojan',
  'shadowsocks',
  'hysteria2',
  'tuic',
  'mtproto',
] as const

export type ProtocolKey = (typeof PROTOCOL_LIST)[number]

export function isProtocol(v: string): v is ProtocolKey {
  return (PROTOCOL_LIST as readonly string[]).includes(v)
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** UTF-8 safe base64 that works in the browser (btoa) and on node (Buffer). */
function b64(s: string): string {
  if (typeof btoa === 'function' && typeof TextEncoder === 'function') {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin)
  }
  return Buffer.from(s, 'utf8').toString('base64')
}

/** Wrap bare IPv6 addresses in [] so they are valid URI hosts. */
export function hostOf(address: string): string {
  const a = (address || '').trim()
  if (a.includes(':') && !a.startsWith('[')) return `[${a}]`
  return a
}

/** Detect the kind of a server address (for the UI helper). */
export function addressKind(address: string): 'ipv4' | 'ipv6' | 'domain' | 'empty' {
  const a = (address || '').trim()
  if (!a) return 'empty'
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(a)) return 'ipv4'
  if (a.includes(':')) return 'ipv6'
  return 'domain'
}

/**
 * Fragment query parameter (Marzban convention, supported by clients like
 * Streisand / Hiddify / NekoBox): fragment=<length>,<interval>,<packets>.
 * Only meaningful on TLS connections. The value is validated by
 * isValidFragment() to only contain [A-Za-z0-9.,-], so it stays URL-safe
 * without encoding (Marzban emits raw commas and clients expect that).
 */
function fragmentParam(p: ProxyLike): string {
  const v = (p.fragment || '').trim().replace(/\s+/g, '')
  if (!v || !p.tls) return ''
  return `fragment=${v}`
}

/** A quick sanity filter for fragment strings like "100-200,20-30,tlshello". */
export function isValidFragment(v: string): boolean {
  const s = (v || '').trim().replace(/\s+/g, '')
  if (!s) return true // empty = no fragment
  return /^[a-zA-Z0-9.,-]+$/.test(s) && s.split(',').length === 3
}

/** Deep links that open the user's VPN app and import the subscription in one tap. */
export function buildDeepLinks(subUrl: string): { id: string; label: string; url: string }[] {
  const enc = encodeURIComponent(subUrl)
  return [
    { id: 'hiddify', label: 'Hiddify', url: `hiddify://import/${subUrl}#Odyssey` },
    { id: 'v2rayng', label: 'v2rayNG', url: `v2rayng://install-sub?url=${enc}&remark=Odyssey` },
    { id: 'v2box', label: 'V2Box', url: `v2box://install-sub?url=${enc}` },
    { id: 'streisand', label: 'Streisand', url: `streisand://import/${subUrl}` },
  ]
}

// ── share links ─────────────────────────────────────────────────────────────

/** Generate a full share URI for one proxy account. */
export function buildShareLink(p: ProxyLike): string {
  const transport = p.transport || 'ws'
  const security = p.tls ? 'tls' : 'none'
  const remark = encodeURIComponent(p.remark || `${p.protocol}-${p.address}`)
  const host = hostOf(p.address)
  const q: string[] = []

  if (p.protocol === 'vless') {
    if (p.flow) q.push(`flow=${p.flow}`)
    q.push(`type=${transport}`)
    q.push(`security=${security}`)
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    if (p.host) q.push(`host=${encodeURIComponent(p.host)}`)
    if (transport === 'ws' && p.path) q.push(`path=${encodeURIComponent(p.path)}`)
    if (transport === 'grpc' && p.path) q.push(`serviceName=${encodeURIComponent(p.path)}`)
    q.push('fp=chrome')
    const frag = fragmentParam(p)
    if (frag) q.push(frag)
    return `vless://${p.secret}@${host}:${p.port}?${q.join('&')}#${remark}`
  }

  if (p.protocol === 'vmess') {
    const obj = {
      v: '2',
      ps: p.remark,
      add: p.address,
      port: String(p.port),
      id: p.secret,
      aid: '0',
      scy: 'auto',
      net: transport,
      type: 'none',
      host: p.host || '',
      path: transport === 'ws' ? p.path || '' : '',
      tls: p.tls ? 'tls' : '',
      sni: p.sni || '',
      fp: 'chrome',
    }
    return `vmess://${b64(JSON.stringify(obj))}`
  }

  if (p.protocol === 'trojan') {
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    if (p.host) q.push(`host=${encodeURIComponent(p.host)}`)
    q.push(`type=${transport}`)
    if (transport === 'ws' && p.path) q.push(`path=${encodeURIComponent(p.path)}`)
    const frag = fragmentParam(p)
    if (frag) q.push(frag)
    return `trojan://${encodeURIComponent(p.secret)}@${host}:${p.port}?${q.join('&')}#${remark}`
  }

  if (p.protocol === 'shadowsocks') {
    const userInfo = b64(`aes-256-gcm:${p.secret}`)
    return `ss://${userInfo}@${host}:${p.port}#${remark}`
  }

  if (p.protocol === 'hysteria2') {
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    q.push('insecure=0')
    return `hysteria2://${encodeURIComponent(p.secret)}@${host}:${p.port}?${q.join('&')}#${remark}`
  }

  if (p.protocol === 'tuic') {
    // secret is stored as "<uuid>:<password>"
    if (p.sni) q.push(`sni=${encodeURIComponent(p.sni)}`)
    q.push('congestion_control=bbr')
    q.push('alpn=h3')
    q.push('udp_relay_mode=native')
    return `tuic://${p.secret}@${host}:${p.port}?${q.join('&')}#${remark}`
  }

  if (p.protocol === 'mtproto') {
    // Telegram MTProto proxy — opens directly in Telegram (and t.me works everywhere)
    const s = encodeURIComponent(p.secret)
    const server = encodeURIComponent(p.address.trim())
    return `https://t.me/proxy?server=${server}&port=${p.port}&secret=${s}`
  }

  return ''
}

/** The tap-able tg:// variant of a Telegram MTProto proxy (for on-phone buttons). */
export function buildTelegramTapLink(p: Pick<ProxyLike, 'address' | 'port' | 'secret'>): string {
  const s = encodeURIComponent(p.secret)
  const server = encodeURIComponent(p.address.trim())
  return `tg://proxy?server=${server}&port=${p.port}&secret=${s}`
}

// ── server-side configs ─────────────────────────────────────────────────────

/** Server-side inbound config (xray / sing-box / mtg format) for the admin's VPS. */
export function buildServerConfig(p: ProxyLike) {
  const transport = p.transport || 'ws'
  const host = hostOf(p.address)

  // xray-compatible family
  if (['vless', 'vmess', 'trojan', 'shadowsocks'].includes(p.protocol)) {
    const streamSettings: Record<string, unknown> = {
      network: transport,
      security: p.tls ? 'tls' : 'none',
    }
    if (p.tls && p.sni) {
      streamSettings.tlsSettings = {
        serverName: p.sni,
        certificates: [
          {
            certificateFile: `/etc/letsencrypt/live/${p.sni}/fullchain.pem`,
            keyFile: `/etc/letsencrypt/live/${p.sni}/privkey.pem`,
          },
        ],
      }
    }
    if (transport === 'ws') {
      streamSettings.wsSettings = {
        path: p.path || '/',
        headers: p.host ? { Host: p.host } : undefined,
      }
    }
    if (transport === 'grpc') {
      streamSettings.grpcSettings = { serviceName: p.path || 'grpc-stream' }
    }

    let protocol = p.protocol
    const settings: Record<string, unknown> = {}
    if (p.protocol === 'vless') {
      settings.clients = [{ id: p.secret, flow: p.flow || '', email: `${p.remark}@panel` }]
      settings.decryption = 'none'
    } else if (p.protocol === 'vmess') {
      settings.clients = [{ id: p.secret, alterId: 0, email: `${p.remark}@panel` }]
    } else if (p.protocol === 'trojan') {
      settings.clients = [{ password: p.secret, email: `${p.remark}@panel` }]
    } else {
      protocol = 'shadowsocks'
      settings.method = 'aes-256-gcm'
      settings.password = p.secret
      settings.network = 'tcp,udp'
    }

    return {
      tag: `in-${(p.remark || 'sub').replace(/\s+/g, '-')}-${p.port}`,
      port: p.port,
      protocol,
      settings,
      streamSettings,
    }
  }

  if (p.protocol === 'hysteria2') {
    // sing-box outbound + minimal server hint
    return {
      tag: `in-${(p.remark || 'sub').replace(/\s+/g, '-')}-${p.port}`,
      core: 'sing-box',
      type: 'hysteria2',
      server_hint: {
        listen: `:${p.port}`,
        users: [{ password: p.secret }],
        tls: { enabled: true, server_name: p.sni || p.address },
      },
      outbound: {
        type: 'hysteria2',
        tag: p.remark,
        server: p.address,
        server_port: p.port,
        password: p.secret,
        tls: { enabled: true, server_name: p.sni || p.address, insecure: false },
      },
    }
  }

  if (p.protocol === 'tuic') {
    const [uuid = '', password = ''] = p.secret.split(':')
    return {
      tag: `in-${(p.remark || 'sub').replace(/\s+/g, '-')}-${p.port}`,
      core: 'sing-box',
      type: 'tuic',
      outbound: {
        type: 'tuic',
        tag: p.remark,
        server: p.address,
        server_port: p.port,
        uuid,
        password,
        congestion_control: 'bbr',
        udp_relay_mode: 'native',
        tls: { enabled: true, server_name: p.sni || p.address, insecure: false },
      },
    }
  }

  if (p.protocol === 'mtproto') {
    return {
      tag: `in-${(p.remark || 'sub').replace(/\s+/g, '-')}-${p.port}`,
      type: 'mtproto',
      note: 'Run an MTProto proxy (e.g. mtg) on your VPS with this secret',
      command: `mtg simple-run -n ${p.sni || 'speedtest.net'} 0.0.0.0:${p.port} ${p.secret}`,
      secret: p.secret,
      port: p.port,
    }
  }

  return { tag: `in-${p.port}`, port: p.port, protocol: p.protocol, note: 'unsupported protocol' }
}

// ── subscription payloads ───────────────────────────────────────────────────

export type SubFormat = 'base64' | 'raw' | 'clash' | 'singbox'

/** Build the full subscription body in the requested format. */
export function buildSubscription(proxies: ProxyLike[], format: SubFormat): { body: string; contentType: string } {
  const links = proxies.map(buildShareLink).filter(Boolean)
  if (format === 'raw') {
    return { body: links.join('\n'), contentType: 'text/plain; charset=utf-8' }
  }
  if (format === 'base64' || !format) {
    return { body: b64(links.join('\n')), contentType: 'text/plain; charset=utf-8' }
  }
  if (format === 'clash') {
    return { body: buildClashYaml(proxies), contentType: 'text/yaml; charset=utf-8' }
  }
  return {
    body: JSON.stringify(buildSingBox(proxies), null, 2),
    contentType: 'application/json; charset=utf-8',
  }
}

function proxyYaml(p: ProxyLike): string | null {
  const t = p.transport || 'ws'
  const lines: string[] = [
    `  - name: "${escapeYaml(p.remark)}"`,
    `    server: ${p.address}`,
    `    port: ${p.port}`,
    `    udp: true`,
  ]
  if (p.protocol === 'vless') {
    lines.push(`    type: vless`, `    uuid: ${p.secret}`, `    tls: ${p.tls}`)
    if (p.sni) lines.push(`    servername: "${escapeYaml(p.sni)}"`)
    lines.push(`    network: ${t}`)
    if (p.flow) lines.push(`    flow: ${p.flow}`)
    if (t === 'ws') {
      lines.push(`    ws-opts:`, `      path: "${escapeYaml(p.path || '/')}"`)
      if (p.host) lines.push(`      headers:`, `        Host: "${escapeYaml(p.host)}"`)
    }
  } else if (p.protocol === 'vmess') {
    lines.push(`    type: vmess`, `    uuid: ${p.secret}`, `    alterId: 0`, `    cipher: auto`, `    tls: ${p.tls}`)
    if (p.sni) lines.push(`    servername: "${escapeYaml(p.sni)}"`)
    lines.push(`    network: ${t}`)
    if (t === 'ws') {
      lines.push(`    ws-opts:`, `      path: "${escapeYaml(p.path || '/')}"`)
      if (p.host) lines.push(`      headers:`, `        Host: "${escapeYaml(p.host)}"`)
    }
  } else if (p.protocol === 'trojan') {
    lines.push(`    type: trojan`, `    password: "${escapeYaml(p.secret)}"`, `    tls: ${p.tls}`)
    if (p.sni) lines.push(`    sni: "${escapeYaml(p.sni)}"`)
    if (t === 'ws') lines.push(`    network: ws`, `    ws-opts:`, `      path: "${escapeYaml(p.path || '/')}"`)
  } else if (p.protocol === 'shadowsocks') {
    lines.push(`    type: ss`, `    cipher: aes-256-gcm`, `    password: "${escapeYaml(p.secret)}"`)
  } else if (p.protocol === 'hysteria2') {
    lines.push(`    type: hysteria2`, `    password: "${escapeYaml(p.secret)}"`)
    if (p.sni) lines.push(`    sni: "${escapeYaml(p.sni)}"`)
  } else if (p.protocol === 'tuic') {
    const [uuid = '', password = ''] = p.secret.split(':')
    lines.push(`    type: tuic`, `    uuid: ${uuid}`, `    password: "${escapeYaml(password)}"`)
    if (p.sni) lines.push(`    sni: "${escapeYaml(p.sni)}"`)
  } else {
    return null // mtproto is not a clash proxy
  }
  return lines.join('\n')
}

function escapeYaml(s: string) {
  return (s || '').replace(/"/g, '\\"')
}

function buildClashYaml(proxies: ProxyLike[]) {
  const entries = proxies.map(proxyYaml).filter(Boolean)
  const names = proxies.map((p) => `      - "${escapeYaml(p.remark)}"`).join('\n')
  return [
    '# Clash (mihomo) subscription generated by the panel',
    'port: 7890',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'proxies:',
    entries.join('\n'),
    'proxy-groups:',
    '  - name: PROXY',
    '    type: select',
    '    proxies:',
    names || '      - DIRECT',
    'rules:',
    '  - MATCH,PROXY',
    '',
  ].join('\n')
}

function buildSingBox(proxies: ProxyLike[]) {
  const outbounds: Record<string, unknown>[] = []
  for (const p of proxies) {
    const t = p.transport || 'ws'
    const base: Record<string, unknown> = {
      tag: p.remark,
      server: p.address,
      server_port: p.port,
    }
    if (p.tls && ['vless', 'vmess', 'trojan'].includes(p.protocol)) {
      base.tls = {
        enabled: true,
        server_name: p.sni || p.address || '',
        insecure: false,
      }
    }
    if (t === 'ws' && ['vless', 'vmess', 'trojan'].includes(p.protocol)) {
      base.transport = { type: 'ws', path: p.path || '/', headers: p.host ? { Host: p.host } : undefined }
    } else if (t === 'grpc' && ['vless', 'vmess', 'trojan'].includes(p.protocol)) {
      base.transport = { type: 'grpc', service_name: p.path || '' }
    }
    if (p.protocol === 'vless') {
      outbounds.push({ type: 'vless', uuid: p.secret, flow: p.flow || '', ...base })
    } else if (p.protocol === 'vmess') {
      outbounds.push({ type: 'vmess', uuid: p.secret, alter_id: 0, security: 'auto', ...base })
    } else if (p.protocol === 'trojan') {
      outbounds.push({ type: 'trojan', password: p.secret, ...base })
    } else if (p.protocol === 'shadowsocks') {
      outbounds.push({ type: 'shadowsocks', method: 'aes-256-gcm', password: p.secret, ...base })
    } else if (p.protocol === 'hysteria2') {
      outbounds.push({
        type: 'hysteria2',
        tag: p.remark,
        server: p.address,
        server_port: p.port,
        password: p.secret,
        tls: { enabled: true, server_name: p.sni || p.address, insecure: false },
      })
    } else if (p.protocol === 'tuic') {
      const [uuid = '', password = ''] = p.secret.split(':')
      outbounds.push({
        type: 'tuic',
        tag: p.remark,
        server: p.address,
        server_port: p.port,
        uuid,
        password,
        congestion_control: 'bbr',
        udp_relay_mode: 'native',
        tls: { enabled: true, server_name: p.sni || p.address, insecure: false },
      })
    }
  }
  return {
    log: { level: 'info' },
    outbounds: [...outbounds, { type: 'direct', tag: 'direct' }],
  }
}
