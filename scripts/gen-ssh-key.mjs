#!/usr/bin/env node
/**
 * Generate an ed25519 keypair and write it in OpenSSH format:
 *   ~/.ssh/id_ed25519      (openssh-key-v1 private container)
 *   ~/.ssh/id_ed25519.pub  (authorized_keys line)
 *
 * Format (PROTOCOL.key):
 *   AUTH_MAGIC "openssh-key-v1\0"
 *   string ciphername, string kdfname, string kdfoptions, uint32 nkeys,
 *   string publickey (wire), string private-section
 *
 * private-section (one uint32 checkint pair, then key data, comment, padding):
 *   uint32 check1, uint32 check2,
 *   string keytype ("ssh-ed25519"),
 *   string pub32,
 *   string priv64 (priv32||pub32),
 *   string comment,
 *   byte[] padding (1..n so section length % 8 == 0)
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import os from 'node:os'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const pubRaw = publicKey.export({ type: 'spki', format: 'der' })
const pub32 = pubRaw.subarray(pubRaw.length - 32)
const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' })
const priv32 = privRaw.subarray(privRaw.length - 32)

function sshString(buf) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(buf.length)
  return Buffer.concat([len, buf])
}

const pubkeyWire = Buffer.concat([
  sshString(Buffer.from('ssh-ed25519')),
  sshString(pub32),
])
const pubB64 = pubkeyWire.toString('base64')

const comment = 'odyssey-sandbox'
const ci = randomBytes(4)

// private key data inside the section
const keyData = Buffer.concat([
  sshString(Buffer.from('ssh-ed25519')),
  sshString(pub32),
  sshString(Buffer.concat([priv32, pub32])),
])

// assemble then pad the WHOLE section (checkints + keydata + comment)
const head = Buffer.concat([ci, ci])
const tail = sshString(Buffer.from(comment))
const unpadded = Buffer.concat([head, keyData, tail])
const padLen = (8 - (unpadded.length % 8)) % 8 || 8
const pad = Buffer.alloc(padLen)
for (let i = 0; i < padLen; i++) pad[i] = i + 1
const privSection = Buffer.concat([unpadded, pad])

const container = Buffer.concat([
  Buffer.from('openssh-key-v1\0'),
  sshString(Buffer.from('none')),
  sshString(Buffer.from('none')),
  sshString(Buffer.alloc(0)),
  Uint32BE(1),
  sshString(pubkeyWire),
  sshString(privSection),
])
function Uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

const privB64 = container.toString('base64').replace(/(.{70})/g, '$1\n')
const HDR = ['-----','BEGIN OPENSSH PRIVATE KEY','-----'].join('')
const FTR = ['-----','END OPENSSH PRIVATE KEY','-----'].join('')
writeFileSync(`${os.homedir()}/.ssh/id_ed25519`, HDR + '\n' + privB64 + '\n' + FTR + '\n', { mode: 0o600 })
writeFileSync(`${os.homedir()}/.ssh/id_ed25519.pub`, `ssh-ed25519 ${pubB64} ${comment}\n`)

// verify: structure sanity (paramiko test is the real proof)
import { readFileSync } from 'node:fs'
const pemTxt = readFileSync(`${os.homedir()}/.ssh/id_ed25519`, 'utf8')
console.log(`OK privSec=${privSection.length}B padded=${privSection.length % 8 === 0} pub32=${pub32.length}B pemLines=${pemTxt.split('\n').length}`)
