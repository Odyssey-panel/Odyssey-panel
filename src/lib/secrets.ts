import { randomBytes } from 'node:crypto'
import { isProtocol } from './links'

/**
 * Generate the `secret` value for a new proxy account, per protocol:
 *  - vless/vmess → UUID
 *  - trojan/shadowsocks/hysteria2 → random password
 *  - tuic → "<uuid>:<password>"
 *  - mtproto → "dd" + 32 hex chars (16-byte FakeTLS secret, Telegram standard)
 */
export function generateSecret(protocol: string): string {
  switch (protocol) {
    case 'vless':
    case 'vmess':
      return crypto.randomUUID()
    case 'tuic':
      return `${crypto.randomUUID()}:${randomBytes(8).toString('base64url')}`
    case 'mtproto':
      return `dd${randomBytes(16).toString('hex')}`
    default:
      return randomBytes(16).toString('base64url')
  }
}

/** Server-side validation for incoming protocol values. */
export function validateProtocol(protocol: string): string | null {
  if (!isProtocol(protocol)) return 'Invalid protocol'
  return null
}
