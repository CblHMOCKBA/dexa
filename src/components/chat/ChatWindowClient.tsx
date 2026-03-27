'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Message, Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import TimerSelect from '@/components/orders/TimerSelect'
import ListingCardMessage, { encodeListingCard, decodeListingCard, type ListingCardData } from '@/components/chat/ListingCardMessage'

type OptimisticMessage = Message & { status?: 'sending'|'sent'|'error'; temp?: boolean }
type ReplyTo = { id: string; text: string; senderName: string } | null
type CtxMenu = { msgId: string; x: number; y: number; own: boolean; text: string } | null
type Props = { chat: Chat; initialMessages: Message[]; currentUserId: string }

// ── Reply encoding ─────────────────────────────────────────
const REPLY_PREFIX = 'REPLY_TO:'
function encodeReply(quote: string, sender: string, body: string) {
  return `${REPLY_PREFIX}${sender}:::${quote.replace(/\n/g, ' ').slice(0, 80)}\n${body}`
}
function decodeReply(text: string): { sender: string; quote: string; body: string } | null {
  if (!text.startsWith(REPLY_PREFIX)) return null
  const rest = text.slice(REPLY_PREFIX.length)
  const nl = rest.indexOf('\n')
  if (nl === -1) return null
  const header = rest.slice(0, nl)
  const sep = header.indexOf(':::')
  if (sep === -1) return null
  return { sender: header.slice(0, sep), quote: header.slice(sep + 3), body: rest.slice(nl + 1) }
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function formatDateSep(d: string) {
  const date = new Date(d), now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// Системные сообщения
const SYS_ORDER = 'SYSTEM:ORDER_CREATED:'
function decodeSystemMsg(text: string): { type: 'order'; orderId: string; price: string; title: string } | null {
  if (!text.startsWith(SYS_ORDER)) return null
  const parts = text.slice(SYS_ORDER.length).split(':')
  if (parts.length < 3) return null
  return { type: 'order', orderId: parts[0], price: parts[1], title: parts.slice(2).join(':') }
}

export default function ChatWindowClient({ chat, initialMessages, currentUserId }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]           = useState<OptimisticMessage[]>(initialMessages)
  const [text, setText]           = useState('')
  const [panel, setPanel]         = useState<'none'|'share'|'order'>('none')
  const [timerMins, setTimerMins]       = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  const [myListings, setMyListings]     = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  // Расширенная форма сделки
  const [dealPrice, setDealPrice]       = useState('')
  const [dealQty, setDealQty]           = useState('1')
  const [dealPayment, setDealPayment]   = useState<'cash'|'transfer'|'crypto'|'other'>('cash')
  const [dealCourier, setDealCourier]   = useState('')
  const [dealNewCourier, setNewCourier] = useState('')
  const [showAddCourier, setShowAddCourier] = useState(false)
  const [couriers, setCouriers]         = useState<{id:string;name:string;phone:string|null}[]>([])
  const [loadingCouriers, setLoadingCouriers] = useState(false)
  const [dealComment, setDealComment]   = useState('')
  // Добавление партнёра в контакты
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactSaving, setContactSaving]   = useState(false)
  const [contactDone, setContactDone]       = useState(false)
  const [contactType, setContactType]       = useState<'buyer'|'supplier'|'both'>('both')
  const [contactPhone, setContactPhone]     = useState('')
  const [showMenu, setShowMenu]         = useState(false)
  const [menuAction, setMenuAction]     = useState<'none'|'delete'|'clear'>('none')
  const [menuLoading, setMenuLoading]   = useState(false)
  const [replyTo, setReplyTo]           = useState<ReplyTo>(null)
  const [ctxMenu, setCtxMenu]           = useState<CtxMenu>(null)

  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const seenIds      = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))
  const longTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const partner     = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
  const partnerName = partner?.name ?? 'Продавец'
  const isBuyer     = currentUserId === chat.buyer_id

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowMenu(false); setPanel('none') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`chat-${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, payload => {
        const m = payload.new as Message
        if (seenIds.current.has(m.id)) return
        seenIds.current.add(m.id)
        setMsgs(prev => {
          const idx = prev.findIndex(x => x.temp && x.sender_id === m.sender_id && x.text === m.text)
          if (idx >= 0) { const u = [...prev]; u[idx] = { ...m, status: 'sent' }; return u }
          return [...prev, { ...m, status: 'sent' }]
        })
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [chat.id])

  // Загружаем курьеров при открытии панели сделки
  useEffect(() => {
    if (panel !== 'order') return
    setLoadingCouriers(true)
    const supabase = createClient()
    supabase.from('counterparties')
      .select('id, name, phone')
      .eq('type', 'courier')
      .then(({ data }) => {
        setCouriers(data ?? [])
        setLoadingCouriers(false)
      })
    // Предзаполняем цену из листинга
    if (chat.listing && !(chat.listing as Listing).price) return
    setDealPrice(String((chat.listing as Listing).price ?? ''))
  }, [panel])

  useEffect(() => {
    if (panel !== 'share' || myListings.length > 0) return
    setLoadingListings(true)
    const supabase = createClient()
    supabase.from('listings').select('id,title,price,brand,model,status,condition,seller_id')
      .eq('seller_id', currentUserId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setMyListings((data as Listing[]) ?? []); setLoadingListings(false) })
  }, [panel, currentUserId, myListings.length])

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // Long press
  function onTouchStart(e: React.TouchEvent, m: OptimisticMessage, own: boolean) {
    const t = e.touches[0]
    longTimer.current = setTimeout(() => {
      navigator.vibrate?.(30)
      setCtxMenu({ msgId: m.id, x: t.clientX, y: t.clientY, own, text: m.text })
    }, 450)
  }
  function onTouchEnd() { if (longTimer.current) clearTimeout(longTimer.current) }

  function ctxCopy() {
    if (!ctxMenu) return
    const d = decodeReply(ctxMenu.text)
    navigator.clipboard?.writeText(d ? d.body : ctxMenu.text)
    setCtxMenu(null)
  }
  function ctxReply() {
    if (!ctxMenu) return
    const m = msgs.find(x => x.id === ctxMenu.msgId)
    if (!m) return
    const d = decodeReply(m.text)
    setReplyTo({ id: m.id, text: d ? d.body : m.text, senderName: m.sender_id === currentUserId ? 'Вы' : partnerName })
    setCtxMenu(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }
  async function ctxDelete() {
    if (!ctxMenu) return
    const id = ctxMenu.msgId; setCtxMenu(null)
    setMsgs(prev => prev.filter(m => m.id !== id))
    const supabase = createClient()
    await supabase.from('messages').delete().eq('id', id)
  }

  async function send(customText?: string) {
    const raw = (customText ?? text).trim()
    if (!raw) return
    if (!customText) { setText(''); if (inputRef.current) inputRef.current.style.height = 'auto' }
    const finalText = replyTo ? encodeReply(replyTo.text, replyTo.senderName, raw) : raw
    if (replyTo) setReplyTo(null)
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const tempMsg: OptimisticMessage = { id: tempId, chat_id: chat.id, sender_id: currentUserId, text: finalText, is_read: false, created_at: new Date().toISOString(), status: 'sending', temp: true }
    seenIds.current.add(tempId)
    setMsgs(prev => [...prev, tempMsg])
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('messages').insert({ chat_id: chat.id, sender_id: currentUserId, text: finalText }).select('id').single()
      if (error) throw error
      if (data?.id) seenIds.current.add(data.id)
      setMsgs(prev => prev.map(m => m.id === tempId ? { ...m, id: data?.id ?? tempId, status: 'sent', temp: false } : m))
    } catch {
      setMsgs(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m))
    }
  }

  async function retrySend(msg: OptimisticMessage) {
    setMsgs(prev => prev.filter(m => m.id !== msg.id)); await send(msg.text)
  }

  async function shareListingCard(listing: Listing) {
    const cardData: ListingCardData = {
      id: listing.id, title: listing.title, price: listing.price,
      brand: listing.brand ?? null, model: (listing as { model?: string }).model ?? null,
      condition: (listing.condition as 'new' | 'used') ?? 'new', seller_id: listing.seller_id,
      seller_name: (listing.seller as { name?: string })?.name ?? 'Продавец',
      status: listing.status as 'active'|'reserved'|'sold',
    }
    await send(encodeListingCard(cardData)); setPanel('none')
  }

  async function saveContact() {
    if (!partner) return
    setContactSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setContactSaving(false); return }
    await supabase.from('counterparties').insert({
      owner_id: user.id,
      name:     partnerName,
      phone:    contactPhone.trim() || null,
      type:     contactType,
      // Сохраняем ссылку на профиль Dexa
      notes:    `Добавлен из чата Dexa · profile/${partner.id}`,
    })
    setContactSaving(false)
    setContactDone(true)
  }

  async function createOrder() {
    if (!chat.listing || orderLoading || !isBuyer) return
    setOrderLoading(true)
    const supabase = createClient()

    // Создаём нового курьера если нужно
    let finalCourierId = dealCourier
    let finalCourierName = ''
    if (showAddCourier && dealNewCourier.trim()) {
      const { data: newCp } = await supabase.from('counterparties').insert({
        name: dealNewCourier.trim(), type: 'courier', owner_id: currentUserId,
      }).select('id,name').single()
      if (newCp) {
        finalCourierId = newCp.id
        finalCourierName = newCp.name
        setCouriers(p => [...p, { id: newCp.id, name: newCp.name, phone: null }])
      }
    } else if (dealCourier) {
      finalCourierName = couriers.find(co => co.id === dealCourier)?.name ?? ''
    }

    const price = dealPrice ? Number(dealPrice) : (chat.listing as Listing).price
    const qty = Number(dealQty) || 1

    const { data: orderData, error } = await supabase.from('orders').insert({
      listing_id:    chat.listing.id,
      chat_id:       chat.id,
      buyer_id:      chat.buyer_id,
      seller_id:     chat.seller_id,
      quantity:      qty,
      total_price:   price * qty,
      timer_minutes: timerMins,
      courier_note:  [finalCourierName, dealComment].filter(Boolean).join(' · ') || null,
    }).select('id').single()

    setOrderLoading(false)
    if (!error && orderData) {
      const priceStr = (price * qty).toLocaleString('ru-RU')
      const courierStr = finalCourierName ? ` · ${finalCourierName}` : ''
      await supabase.from('messages').insert({
        chat_id: chat.id, sender_id: currentUserId,
        text: `SYSTEM:ORDER_CREATED:${orderData.id}:${priceStr}:${chat.listing.title}${courierStr}`,
      })
      setPanel('none')
      setDealPrice(''); setDealQty('1'); setDealCourier('')
      setNewCourier(''); setShowAddCourier(false); setDealComment('')
      router.push(`/orders/${orderData.id}`)
    }
  }

  function isSameGroup(i: number) {
    return i > 0 && msgs[i].sender_id === msgs[i-1].sender_id && isSameDay(msgs[i].created_at, msgs[i-1].created_at)
  }

  function DeliveryStatus({ msg }: { msg: OptimisticMessage }) {
    if (msg.sender_id !== currentUserId) return null
    if (msg.status === 'sending') return <span style={{ opacity: 0.5 }}>⏳</span>
    if (msg.status === 'error')   return <span style={{ color: '#E8251F' }}>!</span>
    return <span style={{ opacity: 0.75 }}>✓</span>
  }

  async function deleteChat() {
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('chat_id', chat.id)
    await supabase.from('chats').delete().eq('id', chat.id)
    router.push('/chat')
  }
  async function clearHistory() {
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('chat_id', chat.id)
    setMsgs([]); setMenuLoading(false); setMenuAction('none'); setShowMenu(false)
  }
  function exportHistory() {
    const lines = msgs.map(m => `[${new Date(m.created_at).toLocaleString('ru-RU')}] ${m.sender_id === currentUserId ? 'Я' : partnerName}: ${m.text}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `dexa-chat-${partnerName}.txt`; a.click(); URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const menuLeft = ctxMenu ? Math.min(Math.max(ctxMenu.x - 100, 8), (typeof window !== 'undefined' ? window.innerWidth : 400) - 210) : 0
  const menuTop  = ctxMenu ? Math.min(ctxMenu.y - 10, (typeof window !== 'undefined' ? window.innerHeight : 700) - 180) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '-webkit-fill-available', background: '#F2F3F5', overflow: 'hidden', position: 'fixed', inset: 0 }}>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, zIndex: 20, position: 'sticky', top: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 10px', paddingTop: 'calc(10px + var(--sat))', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #E8E9ED' }}>
        <Link href="/chat" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <Avatar name={partnerName} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.2 }}>{partnerName}</p>
          {partner?.location && <p style={{ fontSize: 12, color: '#9498AB' }}>{partner.location}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {partner && !isBuyer && (
            <button title="Добавить в контакты" onClick={() => setShowAddContact(true)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: contactDone ? '#E6F9F3' : '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {contactDone ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00B173" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              )}
            </button>
          )}
          <button title="Поделиться карточкой товара" onClick={() => setPanel(p => p === 'share' ? 'none' : 'share')} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: panel === 'share' ? '#EBF2FF' : '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'share' ? '#1E6FEB' : '#9498AB'} strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M13 17h8M17 13v8"/></svg>
          </button>
          {chat.listing && isBuyer && chat.listing.status === 'active' && (
            <button title="Забронировать товар" onClick={() => setPanel(p => p === 'order' ? 'none' : 'order')} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: panel === 'order' ? '#1E6FEB' : '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'order' ? 'white' : '#9498AB'} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(v => !v)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="#9498AB"/><circle cx="12" cy="12" r="1.5" fill="#9498AB"/><circle cx="12" cy="19" r="1.5" fill="#9498AB"/></svg>
            </button>
            {showMenu && (
              <div style={{ position: 'fixed', top: 'calc(10px + var(--sat) + 52px)', right: 12, zIndex: 100, background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', minWidth: 220, overflow: 'hidden', animation: 'pop-in 0.18s var(--spring-bounce) both' }}>
                {([{ icon: '💬', label: 'Поделиться товаром', action: () => { setShowMenu(false); setPanel('share') }, color: '#1A1C21' }, { icon: '📥', label: 'Экспорт истории', action: exportHistory, color: '#1A1C21' }, { icon: '🗑', label: 'Очистить историю', action: () => setMenuAction('clear'), color: '#F0B90B' }, { icon: '🚫', label: 'Удалить чат', action: () => setMenuAction('delete'), color: '#E8251F' }] as const).map((item, i, arr) => (
                  <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '13px 16px', border: 'none', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? '1px solid #F2F3F5' : 'none', textAlign: 'left' }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setShowMenu(false)} />}

      {/* Confirm dialog */}
      {(menuAction === 'delete' || menuAction === 'clear') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 320, animation: 'pop-in 0.2s var(--spring-bounce) both' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 8, textAlign: 'center' }}>{menuAction === 'delete' ? 'Удалить чат?' : 'Очистить историю?'}</p>
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>{menuAction === 'delete' ? 'Чат и все сообщения будут удалены' : 'Все сообщения будут удалены, чат останется'}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setMenuAction('none'); setShowMenu(false) }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#F2F3F5', color: '#1A1C21', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
              <button onClick={menuAction === 'delete' ? deleteChat : clearHistory} disabled={menuLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: menuAction === 'delete' ? '#E8251F' : '#F0B90B', color: menuAction === 'delete' ? 'white' : '#1A1C21', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: menuLoading ? 0.6 : 1 }}>
                {menuLoading ? '...' : menuAction === 'delete' ? 'Удалить' : 'Очистить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEXT MENU (long press) ── */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setCtxMenu(null)} />
          <div style={{ position: 'fixed', top: menuTop, left: menuLeft, zIndex: 201, background: 'white', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', minWidth: 200, overflow: 'hidden', animation: 'pop-in 0.15s var(--spring-bounce) both' }}>
            {[
              { icon: '↩️', label: 'Ответить', action: ctxReply, color: '#1A1C21' },
              { icon: '📋', label: 'Скопировать', action: ctxCopy, color: '#1A1C21' },
              ...(ctxMenu.own ? [{ icon: '🗑', label: 'Удалить', action: ctxDelete, color: '#E8251F' }] : []),
            ].map((item, i, arr) => (
              <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '13px 16px', border: 'none', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? '1px solid #F2F3F5' : 'none', textAlign: 'left' }}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Share / Order panels */}
      {panel === 'share' && (
        <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED', padding: '12px 16px', maxHeight: 260, overflowY: 'auto', animation: 'slide-up 0.2s var(--spring-smooth) both' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Поделиться товаром</p>
          {chat.listing && (<button onClick={() => shareListingCard(chat.listing as Listing)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#F8F9FB', borderRadius: 12, padding: '10px 12px', border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 8, textAlign: 'left' }}><span style={{ fontSize: 20 }}>📦</span><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p><p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽</p></div><span style={{ fontSize: 11, background: '#EBF2FF', color: '#1249A8', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>тема</span></button>)}
          {loadingListings ? <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '8px 0' }}>...</p>
          : myListings.map(l => (<button key={l.id} onClick={() => shareListingCard(l)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#F8F9FB', borderRadius: 12, padding: '10px 12px', border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{l.title}</p><p style={{ fontSize: 12, color: '#00B173', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{l.price.toLocaleString('ru-RU')} ₽</p></div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg></button>))}
        </div>
      )}
      {panel === 'order' && chat.listing && (
        <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED', padding: '14px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both', maxHeight: '70dvh', overflowY: 'auto' }}>

          {/* Заголовок */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>🤝 Провести сделку</p>
            <button onClick={() => setPanel('none')} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F2F3F5', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {/* Товар */}
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#00B173', flexShrink: 0, marginLeft: 8 }}>{(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽</p>
          </div>

          {/* Цена + Кол-во */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Цена ₽</p>
              <input
                type="number" value={dealPrice}
                onChange={e => setDealPrice(e.target.value)}
                placeholder={String((chat.listing as Listing).price ?? '')}
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}
              />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Кол-во</p>
              <input
                type="number" value={dealQty} min={1}
                onChange={e => setDealQty(e.target.value)}
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Метод оплаты */}
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Оплата</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['cash','💵 Нал'],['transfer','🏦 Перевод'],['crypto','₿ Крипто'],['other','📋 Другое']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setDealPayment(val)} style={{
                  padding: '6px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: dealPayment === val ? '#1E6FEB' : '#F2F3F5',
                  color: dealPayment === val ? '#fff' : '#5A5E72',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Курьер */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Курьер</p>
              <button type="button" onClick={() => setShowAddCourier(p => !p)} style={{
                fontSize: 11, fontWeight: 600, color: '#1E6FEB',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                {showAddCourier ? '← Выбрать' : '+ Новый'}
              </button>
            </div>

            {showAddCourier ? (
              <input
                value={dealNewCourier}
                onChange={e => setNewCourier(e.target.value)}
                placeholder="Имя нового курьера..."
                className="input"
              />
            ) : (
              <select
                value={dealCourier}
                onChange={e => setDealCourier(e.target.value)}
                className="input"
                style={{ color: dealCourier ? '#1A1C21' : '#9498AB' }}
              >
                <option value="">— Без курьера / самовывоз —</option>
                {loadingCouriers ? (
                  <option disabled>Загрузка...</option>
                ) : (
                  couriers.map(courier => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name}{courier.phone ? ` · ${courier.phone}` : ''}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Комментарий */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Комментарий</p>
            <input
              value={dealComment}
              onChange={e => setDealComment(e.target.value)}
              placeholder="Адрес доставки, заметка..."
              className="input"
            />
          </div>

          <TimerSelect value={timerMins} onChange={setTimerMins} />

          {/* Итого */}
          {dealPrice && (
            <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 12px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: '#9498AB' }}>Итого · {dealQty} шт</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800, color: '#1A1C21' }}>
                {(Number(dealPrice) * (Number(dealQty) || 1)).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          )}

          <button onClick={createOrder} disabled={orderLoading} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, background: '#1E6FEB', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: orderLoading ? 0.7 : 1 }}>
            {orderLoading ? 'Создаём сделку...' : `🤝 Провести сделку · ${timerMins} мин`}
          </button>
        </div>
      )}

      {chat.listing && panel === 'none' && (
        <div style={{ flexShrink: 0, margin: '8px 12px 0', background: 'white', borderRadius: 12, borderLeft: '3px solid #F0B90B', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: (chat.listing as Listing).status === 'active' ? '#E6F9F3' : '#F2F3F5', color: (chat.listing as Listing).status === 'active' ? '#006644' : '#9498AB' }}>{(chat.listing as Listing).status === 'active' ? 'В наличии' : 'Продан'}</span>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, WebkitOverflowScrolling: 'touch' }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8 }}>
            <Avatar name={partnerName} size="lg" />
            <p style={{ fontWeight: 700, color: '#1A1C21', marginTop: 4 }}>{partnerName}</p>
            <p style={{ fontSize: 13, color: '#9498AB' }}>Начни диалог</p>
          </div>
        )}

        {msgs.map((m, i) => {
          const own     = m.sender_id === currentUserId
          const group   = isSameGroup(i)
          const showSep = i === 0 || !isSameDay(m.created_at, msgs[i-1].created_at)
          const cardData = decodeListingCard(m.text)
          const replyData = !cardData ? decodeReply(m.text) : null

          return (
            <div key={m.id}>
              {showSep && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 8px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>{formatDateSep(m.created_at)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6, marginTop: group && !showSep ? 1 : 6 }}>
                {!own && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {(!msgs[i+1] || msgs[i+1].sender_id !== m.sender_id) && <Avatar name={partnerName} size="xs" />}
                  </div>
                )}

                <div
                  style={{ maxWidth: '78%', opacity: m.status === 'sending' ? 0.7 : 1, transition: 'opacity 0.2s', userSelect: 'none', WebkitUserSelect: 'none' }}
                  onTouchStart={e => onTouchStart(e, m, own)}
                  onTouchEnd={onTouchEnd}
                  onTouchMove={onTouchEnd}
                >
                  {(() => {
                    const sysMsg = decodeSystemMsg(m.text)
                    if (sysMsg) return (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                        <a href={`/orders/${sysMsg.orderId}`} style={{ textDecoration: 'none' }}>
                          <div style={{
                            background: 'rgba(30,111,235,0.08)', border: '1px solid rgba(30,111,235,0.18)',
                            borderRadius: 14, padding: '10px 16px', textAlign: 'center',
                            animation: 'pop-in 0.2s var(--spring-bounce) both',
                          }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#1E6FEB', marginBottom: 3 }}>
                              🔒 Ордер создан
                            </p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', marginBottom: 2 }}>
                              {sysMsg.title}
                            </p>
                            <p style={{ fontSize: 15, fontWeight: 800, color: '#1E6FEB', fontFamily: 'var(--font-mono)' }}>
                              {sysMsg.price} ₽
                            </p>
                            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>Нажми чтобы открыть →</p>
                          </div>
                        </a>
                      </div>
                    )
                    return null
                  })()}
                  {!decodeSystemMsg(m.text) && cardData ? (
                    <ListingCardMessage data={cardData} currentUserId={currentUserId} chatId={chat.id} isOwn={own} timeStr={formatTime(m.created_at)} deliveryStatus={<DeliveryStatus msg={m} />} />
                  ) : !decodeSystemMsg(m.text) && (
                    <>
                      <div style={{ padding: '8px 12px', borderRadius: own ? (group && !showSep ? '18px 4px 4px 18px' : '18px 18px 4px 18px') : (group && !showSep ? '4px 18px 18px 4px' : '4px 18px 18px 18px'), background: m.status === 'error' ? '#FFEBEA' : own ? '#2AABEE' : '#fff', color: m.status === 'error' ? '#A8170F' : own ? '#fff' : '#1A1C21', fontSize: 15, lineHeight: 1.45, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {/* Reply quote */}
                        {replyData && (
                          <div style={{ borderLeft: `3px solid ${own ? 'rgba(255,255,255,0.5)' : '#1E6FEB'}`, borderRadius: '0 6px 6px 0', background: own ? 'rgba(255,255,255,0.12)' : 'rgba(30,111,235,0.07)', padding: '5px 8px', marginBottom: 7 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: own ? 'rgba(255,255,255,0.8)' : '#1E6FEB', marginBottom: 2 }}>{replyData.sender}</p>
                            <p style={{ fontSize: 12, color: own ? 'rgba(255,255,255,0.65)' : '#5A5E72', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{replyData.quote}</p>
                          </div>
                        )}
                        {replyData ? replyData.body : m.text}
                        <span style={{ fontSize: 10, marginLeft: 8, float: 'right', marginTop: 2, whiteSpace: 'nowrap', opacity: 0.65, fontFamily: 'var(--font-mono)', color: m.status === 'error' ? '#A8170F' : 'inherit' }}>
                          {formatTime(m.created_at)}{' '}<DeliveryStatus msg={m} />
                        </span>
                      </div>
                      {m.status === 'error' && (
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                          <button onClick={() => retrySend(m)} style={{ fontSize: 11, color: '#1E6FEB', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>↻ Повторить</button>
                          <button onClick={() => setMsgs(prev => prev.filter(x => x.id !== m.id))} style={{ fontSize: 11, color: '#E8251F', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Удалить</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── REPLY PREVIEW BAR ── */}
      {replyTo && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#EBF2FF', borderTop: '1px solid #D0E4FF', animation: 'slide-up 0.15s ease both' }}>
          <div style={{ width: 3, height: 36, background: '#1E6FEB', borderRadius: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1E6FEB', marginBottom: 2 }}>Ответ — {replyTo.senderName}</p>
            <p style={{ fontSize: 12, color: '#5A5E72', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(30,111,235,0.15)', color: '#1E6FEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── INPUT ── */}
      <div style={{ flexShrink: 0, zIndex: 20, position: 'sticky', bottom: 0, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px', paddingBottom: 'calc(10px + var(--sab))', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid #E8E9ED' }}>
        <textarea ref={inputRef} value={text} onChange={e => { setText(e.target.value); resize(e.target) }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Сообщение..." rows={1}
          style={{ flex: 1, background: '#F2F3F5', border: '1.5px solid transparent', borderRadius: 22, padding: '10px 16px', fontSize: 15, color: '#1A1C21', outline: 'none', resize: 'none', overflow: 'hidden', minHeight: 44, maxHeight: 120, fontFamily: 'system-ui', transition: 'border-color 0.15s, background 0.15s' }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
        />
        <button onClick={() => send()} disabled={!text.trim()} style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', background: text.trim() ? '#2AABEE' : '#E0E1E6', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, transform 0.1s', transform: text.trim() ? 'scale(1)' : 'scale(0.9)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  )
}
