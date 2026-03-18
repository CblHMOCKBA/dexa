'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Message, Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import TimerSelect from '@/components/orders/TimerSelect'

type Props = { chat: Chat; initialMessages: Message[]; currentUserId: string }

export default function ChatWindowClient({ chat, initialMessages, currentUserId }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]           = useState<Message[]>(initialMessages)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [panel, setPanel]         = useState<'none' | 'share' | 'order'>('none')
  const [timerMins, setTimerMins] = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  // Поделиться товаром из склада
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const seenIds   = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  const partner     = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
  const partnerName = partner?.name ?? 'Продавец'
  const isBuyer     = currentUserId === chat.buyer_id

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: msgs.length <= initialMessages.length ? 'instant' : 'smooth' })
  }, [msgs])

  // Realtime подписка
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chat.id}`,
      }, payload => {
        const m = payload.new as Message
        if (seenIds.current.has(m.id)) return
        seenIds.current.add(m.id)
        setMsgs(prev => [...prev, m])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [chat.id])

  // Загружаем свои товары для шеринга
  useEffect(() => {
    if (panel !== 'share') return
    if (myListings.length > 0) return
    setLoadingListings(true)
    const supabase = createClient()
    supabase.from('listings').select('id,title,price,brand,status')
      .eq('seller_id', currentUserId).eq('status', 'active').order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setMyListings((data as Listing[]) ?? []); setLoadingListings(false) })
  }, [panel])

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function send(customText?: string) {
    const t = (customText ?? text).trim()
    if (!t || sending) return
    setSending(true)
    if (!customText) { setText(''); if (inputRef.current) inputRef.current.style.height = 'auto' }
    const supabase = createClient()
    const { data } = await supabase.from('messages')
      .insert({ chat_id: chat.id, sender_id: currentUserId, text: t })
      .select('id').single()
    if (data?.id) seenIds.current.add(data.id)
    setSending(false)
  }

  async function shareListingCard(listing: Listing) {
    const t = `📦 *${listing.title}*\n💰 ${listing.price.toLocaleString('ru-RU')} ₽${listing.brand ? `\n🏷 ${listing.brand}` : ''}`
    await send(t)
    setPanel('none')
  }

  async function shareChatListing() {
    if (!chat.listing) return
    const t = `📦 *${chat.listing.title}*\n💰 ${chat.listing.price.toLocaleString('ru-RU')} ₽`
    await send(t)
    setPanel('none')
  }

  async function createOrder() {
    if (!chat.listing || orderLoading || !isBuyer) return
    setOrderLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('orders').insert({
      listing_id: chat.listing.id, chat_id: chat.id,
      buyer_id: chat.buyer_id, seller_id: chat.seller_id,
      quantity: 1, total_price: chat.listing.price, timer_minutes: timerMins,
    })
    setOrderLoading(false)
    if (!error) { setPanel('none'); router.push('/orders') }
  }

  function togglePanel(p: 'share' | 'order') {
    setPanel(prev => prev === p ? 'none' : p)
  }

  // Группировка сообщений — не повторяем аватар подряд
  function isSameGroup(i: number) {
    if (i === 0) return false
    return msgs[i].sender_id === msgs[i - 1].sender_id
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: '#F2F3F5',
      overflow: 'hidden', // ← ключевой фикс: изолируем overflow
    }}>

      {/* ── HEADER — всегда виден ── */}
      <div style={{
        flexShrink: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 10px', paddingTop: 'calc(10px + var(--sat))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E9ED',
      }}>
        <Link href="/chat" style={{ display: 'flex', alignItems: 'center', color: '#1E6FEB', textDecoration: 'none', gap: 2 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>

        <Avatar name={partnerName} size="sm" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.2 }}>{partnerName}</p>
          {partner?.location && (
            <p style={{ fontSize: 12, color: '#9498AB' }}>{partner.location}</p>
          )}
        </div>

        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => togglePanel('share')} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: panel === 'share' ? '#EBF2FF' : '#F2F3F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'share' ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
              <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
              <rect x="3" y="13" width="8" height="8" rx="1"/>
              <path d="M13 17h8M17 13v8"/>
            </svg>
          </button>

          {chat.listing && isBuyer && chat.listing.status === 'active' && (
            <button onClick={() => togglePanel('order')} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: panel === 'order' ? '#1E6FEB' : '#F2F3F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'order' ? 'white' : '#9498AB'} strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── ПАНЕЛЬ: ПОДЕЛИТЬСЯ ТОВАРОМ ── */}
      {panel === 'share' && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '12px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both',
          maxHeight: 260, overflowY: 'auto',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Поделиться товаром
          </p>

          {/* Товар из чата */}
          {chat.listing && (
            <button onClick={shareChatListing} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: '#F8F9FB', borderRadius: 12, padding: '10px 12px',
              border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 8, textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
                <p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {chat.listing.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <span style={{ fontSize: 11, color: '#9498AB', background: '#EBF2FF', padding: '2px 8px', borderRadius: 6, color: '#1249A8', fontWeight: 700 }}>
                Тема чата
              </span>
            </button>
          )}

          {/* Мои товары */}
          {loadingListings ? (
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '8px 0' }}>Загрузка...</p>
          ) : myListings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myListings.map(l => (
                <button key={l.id} onClick={() => shareListingCard(l)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F8F9FB', borderRadius: 12, padding: '10px 12px',
                  border: '1.5px solid #E0E1E6', cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{l.title}</p>
                    <p style={{ fontSize: 12, color: '#00B173', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {l.price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
                    <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                  </svg>
                </button>
              ))}
            </div>
          ) : !chat.listing && (
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '12px 0' }}>
              Нет активных товаров на складе
            </p>
          )}
        </div>
      )}

      {/* ── ПАНЕЛЬ: СОЗДАТЬ ОРДЕР ── */}
      {panel === 'order' && chat.listing && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '14px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>🔒 Создать ордер</p>
            <button onClick={() => setPanel('none')} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#F2F3F5', color: '#5A5E72', cursor: 'pointer', fontSize: 16,
            }}>×</button>
          </div>
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E6FEB', marginTop: 3 }}>
              {chat.listing.price.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <TimerSelect value={timerMins} onChange={setTimerMins} />
          <button onClick={createOrder} disabled={orderLoading} style={{
            width: '100%', marginTop: 12, padding: '13px', borderRadius: 12,
            background: '#1E6FEB', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: orderLoading ? 'not-allowed' : 'pointer',
            opacity: orderLoading ? 0.7 : 1,
          }}>
            {orderLoading ? 'Создаём...' : `Забронировать · ${timerMins} мин`}
          </button>
        </div>
      )}

      {/* ── КАРТОЧКА ТОВАРА В ТЕМЕ ── */}
      {chat.listing && panel === 'none' && (
        <div style={{
          flexShrink: 0, margin: '8px 12px 0',
          background: 'white', borderRadius: 12,
          borderLeft: '3px solid #F0B90B', padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {chat.listing.price.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: chat.listing.status === 'active' ? '#E6F9F3' : '#F2F3F5',
            color: chat.listing.status === 'active' ? '#006644' : '#9498AB',
          }}>
            {chat.listing.status === 'active' ? 'В наличии' : 'Продан'}
          </span>
        </div>
      )}

      {/* ── СООБЩЕНИЯ — скроллится только этот блок ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8 }}>
            <Avatar name={partnerName} size="lg" />
            <p style={{ fontWeight: 700, color: '#1A1C21', marginTop: 4 }}>{partnerName}</p>
            <p style={{ fontSize: 13, color: '#9498AB' }}>Начни диалог</p>
          </div>
        )}

        {msgs.map((m, i) => {
          const own   = m.sender_id === currentUserId
          const group = isSameGroup(i)
          const nextOwn = i < msgs.length - 1 && msgs[i + 1].sender_id === m.sender_id

          return (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: own ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end', gap: 6,
              marginTop: group ? 1 : 8,
            }}>
              {/* Аватар — только для последнего в группе */}
              {!own && (
                <div style={{ width: 28, flexShrink: 0, alignSelf: 'flex-end' }}>
                  {!nextOwn && m.sender_id !== msgs[i+1]?.sender_id ? (
                    <Avatar name={partnerName} size="xs" />
                  ) : null}
                </div>
              )}

              <div style={{ maxWidth: '75%' }}>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: own
                    ? (group ? '18px 4px 4px 18px' : '18px 18px 4px 18px')
                    : (group ? '4px 18px 18px 4px' : '4px 18px 18px 18px'),
                  background: own ? '#2AABEE' : '#fff',
                  color: own ? '#fff' : '#1A1C21',
                  fontSize: 15, lineHeight: 1.45,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.text}
                  {/* Время внутри пузыря справа снизу — как в Telegram */}
                  <span style={{
                    fontSize: 10, opacity: 0.65, marginLeft: 8, float: 'right',
                    marginTop: 2, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                  }}>
                    {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {own && ' ✓'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT — всегда виден ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px', paddingBottom: 'calc(10px + var(--sab))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid #E8E9ED',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Сообщение..."
          rows={1}
          style={{
            flex: 1, background: '#F2F3F5', border: '1.5px solid transparent',
            borderRadius: 22, padding: '10px 16px', fontSize: 15, color: '#1A1C21',
            outline: 'none', resize: 'none', overflow: 'hidden',
            minHeight: 44, maxHeight: 120, fontFamily: 'system-ui',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
        />
        <button
          onClick={() => send()}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: text.trim() ? '#2AABEE' : '#E0E1E6',
            cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, transform 0.1s',
            transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
