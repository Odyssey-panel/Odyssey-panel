/**
 * Telegram bot integration: long-polling loop, command handlers,
 * sales flow (choose plan → upload payment proof → admin approve/reject),
 * channel posting and shared order decision logic (used by the panel too).
 */
import { db } from '@/lib/db'
import { getSettings, getBaseUrl, setSettings, type PanelSettings } from '@/lib/settings'
import { randomBytes } from 'node:crypto'

export type TgUser = { id: number; username?: string; first_name?: string; last_name?: string }
export type TgChat = { id: number; type: string; title?: string; username?: string }
export type TgMessage = {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
  photo?: { file_id: string }[]
  document?: { file_id: string; file_name?: string }
  caption?: string
}
export type TgCallbackQuery = {
  id: string
  from: TgUser
  data?: string
  message?: TgMessage
}
export type TgUpdate = {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

type ProofState = { planId: string; planName: string; amount: number; currency: string; expires: number }

// Chat state machine survives dev hot reload via globalThis
const g = globalThis as unknown as {
  __tgPendingProof?: Map<number, ProofState>
  __tgPollingToken?: string
}
const pendingProof = (g.__tgPendingProof ??= new Map<number, ProofState>())

const API_BASE = 'https://api.telegram.org'

export async function tgCall<T = unknown>(token: string, method: string, payload?: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(40000),
    })
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string }
    return data
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : String(e) }
  }
}

export function tgFileUrl(token: string, filePath: string) {
  return `${API_BASE}/file/bot${token}/${filePath}`
}

export async function tgGetFilePath(token: string, fileId: string): Promise<string | null> {
  const res = await tgCall<{ file_path?: string }>(token, 'getFile', { file_id: fileId })
  return res.ok ? res.result?.file_path ?? null : null
}

function adminIds(settings: PanelSettings): string[] {
  return settings.adminChatIds
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminChat(chatId: number | string, settings: PanelSettings) {
  return adminIds(settings).includes(String(chatId))
}

export async function sendToAdmins(settings: PanelSettings, text: string, replyMarkup?: Record<string, unknown>) {
  for (const id of adminIds(settings)) {
    await tgCall(settings.botToken, 'sendMessage', {
      chat_id: id,
      text,
      reply_markup: replyMarkup,
    })
  }
}

export async function sendToChannel(settings: PanelSettings, text: string) {
  if (!settings.channelId || !settings.botToken) return { ok: false, description: 'channel not configured' }
  return tgCall(settings.botToken, 'sendMessage', { chat_id: settings.channelId, text })
}

function inlineKeyboard(rows: { text: string; callback_data?: string; url?: string }[][]) {
  return { inline_keyboard: rows.map((row) => row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.callback_data }))) }
}

// ---------------------------------------------------------------------------
// Sales flow helpers
// ---------------------------------------------------------------------------

async function handleStart(msg: TgMessage, settings: PanelSettings) {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] })
  const name = msg.from?.first_name || 'there'
  const rows = plans.map((p) => [
    { text: `${p.name} — ${p.price} ${p.currency} · ${p.trafficGb}GB / ${p.durationDays}d`, callback_data: `plan:${p.id}` },
  ])
  rows.push([{ text: 'ℹ️ My chat ID', callback_data: 'myid' }])
  await tgCall(settings.botToken, 'sendMessage', {
    chat_id: msg.chat.id,
    text:
      `👋 Welcome, ${name}!\n\nPick a plan below to subscribe. After choosing, you upload your payment proof and the admin approves your order, then your personal subscription link arrives here.`,
    reply_markup: inlineKeyboard(rows),
  })
}

async function handlePlanPick(cb: TgCallbackQuery, planId: string, settings: PanelSettings) {
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan || !plan.active) {
    await tgCall(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Plan unavailable' })
    return
  }
  pendingProof.set(cb.from.id, {
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    currency: plan.currency,
    expires: Date.now() + 30 * 60 * 1000,
  })
  await tgCall(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id, text: `Plan ${plan.name} selected` })
  await tgCall(settings.botToken, 'sendMessage', {
    chat_id: cb.from.id,
    text:
      `🧾 Order draft: ${plan.name}\n💰 Amount: ${plan.price} ${plan.currency}\n📦 Traffic: ${plan.trafficGb} GB\n⏳ Duration: ${plan.durationDays} days\n\n` +
      (settings.paymentsInfo ? settings.paymentsInfo + '\n\n' : '') +
      '📎 Now send your payment proof here as a photo or file.',
  })
}

async function createOrderFromProof(msg: TgMessage, state: ProofState, fileId: string, settings: PanelSettings) {
  const from = msg.from
  const order = await db.order.create({
    data: {
      tgUserId: String(from?.id ?? msg.chat.id),
      tgUsername: from?.username ?? null,
      tgName: [from?.first_name, from?.last_name].filter(Boolean).join(' ') || null,
      planId: state.planId,
      planName: state.planName,
      amount: state.amount,
      currency: state.currency,
      status: 'pending',
      proofFileId: fileId,
    },
  })
  pendingProof.delete(from?.id ?? msg.chat.id)
  await tgCall(settings.botToken, 'sendMessage', {
    chat_id: msg.chat.id,
    text: `✅ Payment proof received — order #${order.id.slice(-6).toUpperCase()} is pending review.\nYou will get your subscription link as soon as the admin approves it.`,
  })
  await notifyAdminsNewOrder(order.id, settings)
}

async function notifyAdminsNewOrder(orderId: string, settings: PanelSettings) {
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) return
  const user = order.tgUsername ? `@${order.tgUsername}` : order.tgName || order.tgUserId
  const text =
    `🧾 New order #${order.id.slice(-6).toUpperCase()}\n` +
    `👤 User: ${user} (id: ${order.tgUserId})\n` +
    `📋 Plan: ${order.planName}\n` +
    `💰 Amount: ${order.amount} ${order.currency}`
  const rows = [[
    { text: '✅ Approve', callback_data: `ord:ok:${order.id}` },
    { text: '❌ Reject', callback_data: `ord:no:${order.id}` },
  ]]
  const markup = inlineKeyboard(rows)
  if (order.proofFileId) {
    for (const id of adminIds(settings)) {
      await tgCall(settings.botToken, 'sendPhoto', {
        chat_id: id,
        photo: order.proofFileId,
        caption: text,
        reply_markup: markup,
      })
    }
  } else {
    await sendToAdmins(settings, text, markup)
  }
}

/** Approve an order: create the client + subscription, notify buyer, post to channel. */
export async function approveOrder(orderId: string, settings: PanelSettings) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { plan: true } })
  if (!order || order.status !== 'pending') return { ok: false, description: 'Order not pending' }

  const plan = order.plan
  const trafficGb = plan?.trafficGb ?? 10
  const days = plan?.durationDays ?? 30
  const base = (await getBaseUrl()) || ''
  const subToken = randomBytes(16).toString('hex')
  let name = (order.tgUsername || order.tgName || `user-${order.tgUserId}`).replace(/\s+/g, '-').slice(0, 40)
  const exists = await db.client.findUnique({ where: { name } })
  if (exists || !name) name = `${name || 'user'}-${randomBytes(2).toString('hex')}`
  const expiresAt = new Date(Date.now() + days * 86400000)
  const client = await db.client.create({
    data: {
      name,
      note: `Telegram order #${order.id.slice(-6).toUpperCase()} · ${order.tgUsername ? '@' + order.tgUsername : order.tgUserId}`,
      limitBytes: BigInt(Math.round(trafficGb * 1024 ** 3)),
      expiresAt,
      subToken,
    },
  })
  await db.order.update({
    where: { id: orderId },
    data: { status: 'approved', decidedAt: new Date(), clientId: client.id },
  })

  const subUrl = base ? `${base}/api/sub/${subToken}` : `⚠️ Panel URL unknown yet — set it in Settings → Panel, then re-send with /pending`
  const expiry = expiresAt.toISOString().slice(0, 10)
  await tgCall(settings.botToken, 'sendMessage', {
    chat_id: order.tgUserId,
    text:
      `🎉 Your order #${order.id.slice(-6).toUpperCase()} was approved!\n\n` +
      `👤 Username: ${client.name}\n📦 Traffic: ${trafficGb} GB\n⏳ Expires: ${expiry}\n\n🔗 Your subscription link:\n${subUrl}\n\n` +
      `Import it in v2rayNG / Nekobox / Streisand etc. (it also works as Clash / sing-box by adding ?format=clash or ?format=singbox).`,
  })

  const user = order.tgUsername ? `@${order.tgUsername}` : order.tgName || order.tgUserId
  const post = (settings.channelTemplate || '')
    .replaceAll('{plan}', order.planName)
    .replaceAll('{user}', user)
    .replaceAll('{traffic}', `${trafficGb} GB`)
    .replaceAll('{expiry}', expiry)
    .replaceAll('{sub_url}', subUrl)
  if (settings.channelId) {
    await sendToChannel(settings, post)
  }
  return { ok: true, clientId: client.id }
}

export async function rejectOrder(orderId: string, settings: PanelSettings) {
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'pending') return { ok: false, description: 'Order not pending' }
  await db.order.update({ where: { id: orderId }, data: { status: 'rejected', decidedAt: new Date() } })
  await tgCall(settings.botToken, 'sendMessage', {
    chat_id: order.tgUserId,
    text: `❌ Your order #${order.id.slice(-6).toUpperCase()} was rejected. If you believe this is a mistake, please contact support.`,
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Update router
// ---------------------------------------------------------------------------

export async function handleUpdate(update: TgUpdate, settings: PanelSettings) {
  if (update.callback_query) {
    const cb = update.callback_query
    const data = cb.data || ''
    if (data.startsWith('plan:')) {
      await handlePlanPick(cb, data.slice(5), settings)
    } else if (data.startsWith('ord:ok:')) {
      const orderId = data.slice(7)
      if (!isAdminChat(cb.from.id, settings)) {
        await tgCall(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Admins only' })
        return
      }
      const res = await approveOrder(orderId, settings)
      await tgCall(settings.botToken, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: res.ok ? 'Approved ✓' : res.description || 'Failed',
      })
      if (cb.message) {
        await tgCall(settings.botToken, 'editMessageReplyMarkup', {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: inlineKeyboard([[{ text: '✅ Approved', callback_data: 'noop' }]]),
        })
      }
    } else if (data.startsWith('ord:no:')) {
      const orderId = data.slice(7)
      if (!isAdminChat(cb.from.id, settings)) {
        await tgCall(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Admins only' })
        return
      }
      const res = await rejectOrder(orderId, settings)
      await tgCall(settings.botToken, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: res.ok ? 'Rejected ✗' : res.description || 'Failed',
      })
      if (cb.message) {
        await tgCall(settings.botToken, 'editMessageReplyMarkup', {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: inlineKeyboard([[{ text: '❌ Rejected', callback_data: 'noop' }]]),
        })
      }
    } else if (data === 'myid') {
      await tgCall(settings.botToken, 'answerCallbackQuery', {
        callback_query_id: cb.id,
        text: `Your chat ID: ${cb.from.id}`,
      })
    } else if (data === 'noop') {
      await tgCall(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id })
    }
    return
  }

  const msg = update.message
  if (!msg) return
  const chatId = msg.chat.id
  const from = msg.from

  if (msg.text && msg.text.startsWith('/')) {
    const cmd = msg.text.split(/\s+/)[0].replace(/@.*$/, '')
    if (cmd === '/start') return handleStart(msg, settings)
    if (cmd === '/id') {
      await tgCall(settings.botToken, 'sendMessage', {
        chat_id: chatId,
        text: `🆔 Chat ID: ${chatId}\nUse it in Settings → Telegram → Admin chat IDs.`,
      })
      return
    }
    if (cmd === '/plans') return handleStart(msg, settings)
    if (cmd === '/pending') {
      if (!isAdminChat(chatId, settings)) return
      const orders = await db.order.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 10 })
      if (!orders.length) {
        await tgCall(settings.botToken, 'sendMessage', { chat_id: chatId, text: 'No pending orders.' })
        return
      }
      for (const o of orders) await notifyAdminsNewOrder(o.id, settings)
      return
    }
    return
  }

  // payment proof upload?
  const state = pendingProof.get(chatId)
  if (state && (msg.photo || msg.document)) {
    if (state.expires < Date.now()) {
      pendingProof.delete(chatId)
      await tgCall(settings.botToken, 'sendMessage', {
        chat_id: chatId,
        text: '⌛ The order draft expired. Please pick a plan again with /start.',
      })
      return
    }
    const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document!.file_id
    await createOrderFromProof(msg, state, fileId, settings)
    return
  }
  if (state) {
    await tgCall(settings.botToken, 'sendMessage', {
      chat_id: chatId,
      text: '📎 Please send your payment proof as a photo or file. To pick a different plan, use /start.',
    })
    return
  }
  // default: show the shop
  await handleStart(msg, settings)
}

// ---------------------------------------------------------------------------
// Long-polling loop
// ---------------------------------------------------------------------------

let pollErrorCount = 0

/** One long-poll round; called repeatedly by the jobs scheduler. */
export async function pollTelegramOnce() {
  const settings = await getSettings()
  if (!settings.botToken || settings.botMode !== 'polling') {
    g.__tgPollingToken = undefined
    return
  }
  const offset = Number(settings.updateOffset || 0)
  const res = await tgCall<TgUpdate[]>(settings.botToken, 'getUpdates', {
    offset,
    timeout: 25,
    allowed_updates: ['message', 'callback_query'],
  })
  if (!res.ok || !Array.isArray(res.result)) {
    pollErrorCount++
    if (pollErrorCount <= 2) console.warn('[telegram] poll failed:', res.description)
    return
  }
  pollErrorCount = 0
  for (const update of res.result) {
    try {
      await handleUpdate(update, settings)
    } catch (e) {
      console.error('[telegram] handleUpdate error', e)
    }
  }
  const nextOffset = res.result.length ? res.result[res.result.length - 1].update_id + 1 : offset
  if (nextOffset !== offset) await setSettings({ updateOffset: String(nextOffset) })
}

/** Start the polling loop if enabled and not already running for this token. */
export function ensurePolling() {
  void (async () => {
    const settings = await getSettings()
    if (!settings.botToken || settings.botMode !== 'polling') return
    if (g.__tgPollingToken === settings.botToken) return // loop already active
    g.__tgPollingToken = settings.botToken
    console.log('[telegram] polling loop started')
    while (g.__tgPollingToken === settings.botToken) {
      try {
        await pollTelegramOnce()
      } catch (e) {
        console.error('[telegram] poll error', e)
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
    console.log('[telegram] polling loop stopped')
  })()
}

export function stopPolling() {
  g.__tgPollingToken = undefined
}
