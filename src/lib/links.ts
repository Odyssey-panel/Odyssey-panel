/**
 * Builders for proxy share links (vless/vmess/trojan/shadowsocks),
 * server-side inbound configs (xray / sing-box compatible) and
 * subscription payloads (base64 / clash / sing-box).
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
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')

/** Generate a full share URI for one proxy account. */
export function buildShareLink(p: ProxyLike): string {
  const transport = p.transport || 'ws'
  const security = p.tls ? 'tls' : 'none'
  const remark = encodeURIComponent(p.remark || `${p.protocol}-${p.address}`)
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
    return `vless://${p.secret}@${p.address}:${p.port}?${q.join('&')}#${remark}`
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
    return `trojan://${encodeURIComponent(p.secret)}@${p.address}:${p.port}?${q.join('&')}#${remark}`
  }
  if (p.protocol === 'shadowsocks') {
    const userInfo = b64(`aes-256-gcm:${p.secret}`)
    return `ss://${userInfo}@${p.address}:${p.port}#${remark}`
  }
  return ''
}

/** Server-side inbound config (xray format) so the admin can paste it on the VPS. */
export function buildServerConfig(p: ProxyLike) {
  const transport = p.transport || 'ws'
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
    protocol = 'vmess'
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
  } else {
    return null
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
    if (p.tls) {
      base.tls = {
        enabled: true,
        server_name: p.sni || p.address || '',
        insecure: false,
      }
    }
    if (t === 'ws') {
      base.transport = { type: 'ws', path: p.path || '/', headers: p.host ? { Host: p.host } : undefined }
    } else if (t === 'grpc') {
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
    }
  }
  return {
    log: { level: 'info' },
    outbounds: [...outbounds, { type: 'direct', tag: 'direct' }],
  }
}
