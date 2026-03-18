'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type ListingCardData = {
  id: string
  title: string
  price: number
  brand: string | null
  model: string | null
  condition: 'new' | 'used'
  seller_id: string
  seller_name: string
  status: 'active' | 'reserved' | 'sold'
}

// Формат сообщения — JSON строка начинающаяся с LISTING_CARD:
export const CARD_PREFIX = 'LISTING_CARD:'

export function encodeListingCard(data: ListingCardData): string {
  return CARD_PREFIX + JSON.stringify(data)
}

export function decodeListingCard(text: string): ListingCardData | null {
  if (!text.startsWith(CARD_PREFIX)) return null
  try {
    return JSON.parse(text.slice(CARD_PREFIX.length))
  } catch {
    return null
  }
}

type Props = {
  data: ListingCardData
  currentUserId: string
  chatId?: string        // если есть — показываем кнопку "Написать" открывающую этот чат
  isOwn: boolean         // отправитель = я → не показываем кнопки действий
  timeStr: string
  deliveryStatus?: React.ReactNode
}

export default function ListingCardMessage({
  data, currentUserId, chatId, isOwn, timeStr, deliveryStatus
}: Props) {
  const router = useRouter()
  const [chatLoading, setChatLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [done, setDone] = useState<'order' | 'chat' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSeller   = currentUserId === data.seller_id
  const isAvail    = data.status === 'active'
  const canAct     = !isOwn && !isSeller && isAvail

  async function openChat() {
    if (chatId) { router.push(`/chat/${chatId}`); return }
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: data.id, seller_id: data.seller_id }),
      })
      const json = await res.json()
      if (json.id) { router.push(`/chat/${json.id}`); setDone('chat') }
    } catch {
      setError('Ошибка')
    } finally {
      setChatLoading(false)
    }
  }

  async function createOrder() {
    setOrderLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not auth')

      // Находим или создаём чат
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: data.id, seller_id: data.seller_id }),
      })
      const chatData = await res.json()
      if (!chatData.id) throw new Error('no chat')

      const { error: orderErr } = await supabase.from('orders').insert({
        listing_id:    data.id,
        chat_id:       chatData.id,
        buyer_id:      user.id,
        seller_id:     data.seller_id,
        quantity:      1,
        total_price:   data.price,
        timer_minutes: 30,
      })

      if (orderErr) throw orderErr
      setDone('order')
      router.push('/orders')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setOrderLoading(false)
    }
  }

  const conditionLabel = data.condition === 'new' ? 'Новый' : 'Б/У'
  const conditionColor = data.condition === 'new' ? '#006644' : '#7A4F00'
  const conditionBg    = data.condition === 'new' ? '#E6F9F3' : '#FFF4E0'

  return (
    <div style={{
      background: 'white',
      borderRadius: isOwn ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      width: 260,
      opacity: 1,
    }}>
      {/* Шапка карточки */}
      <div style={{
        background: isOwn ? '#2AABEE' : '#EBF2FF',
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>📦</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: isOwn ? 'rgba(255,255,255,0.8)' : '#1249A8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Товар
          </span>
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: isOwn ? 'white' : '#1A1C21', lineHeight: 1.3, marginBottom: 2 }}>
          {data.title}
        </p>
        {(data.brand || data.model) && (
          <p style={{ fontSize: 12, color: isOwn ? 'rgba(255,255,255,0.75)' : '#9498AB' }}>
            {[data.brand, data.model].filter(Boolean).join(' ')}
          </p>
        )}
      </div>

      {/* Цена + состояние */}
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#1E6FEB', fontFamily: 'var(--font-mono)' }}>
          {data.price.toLocaleString('ru-RU')} ₽
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: conditionBg, color: conditionColor }}>
            {conditionLabel}
          </span>
          {data.status !== 'active' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F2F3F5', color: '#9498AB' }}>
              {data.status === 'sold' ? 'Продан' : 'Бронь'}
            </span>
          )}
        </div>
      </div>

      {/* Кнопки действий — только для получателя */}
      {canAct && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && (
            <p style={{ fontSize: 11, color: '#E8251F', textAlign: 'center', margin: '0 0 4px' }}>{error}</p>
          )}

          {done === 'order' ? (
            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 13, fontWeight: 700, color: '#006644' }}>
              ✓ Ордер создан
            </div>
          ) : (
            <>
              {/* Купить / Забронировать */}
              <button onClick={createOrder} disabled={orderLoading} style={{
                width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                background: '#1E6FEB', color: 'white', fontSize: 13, fontWeight: 700,
                cursor: orderLoading ? 'not-allowed' : 'pointer',
                opacity: orderLoading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
                {orderLoading ? '...' : '🔒 Забронировать'}
              </button>

              {/* Написать продавцу */}
              <button onClick={openChat} disabled={chatLoading} style={{
                width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                background: '#F2F3F5', color: '#1A1C21', fontSize: 13, fontWeight: 600,
                cursor: chatLoading ? 'not-allowed' : 'pointer',
                opacity: chatLoading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
                {chatLoading ? '...' : '💬 Написать продавцу'}
              </button>

              {/* Открыть карточку товара */}
              <button onClick={() => router.push(`/listing/${data.id}`)} style={{
                width: '100%', padding: '9px 0', borderRadius: 10,
                border: '1.5px solid #E0E1E6', background: 'white',
                color: '#5A5E72', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                👁 Смотреть товар
              </button>
            </>
          )}
        </div>
      )}

      {/* Для продавца — просто кнопка перейти к товару */}
      {isSeller && isOwn && (
        <div style={{ padding: '0 10px 10px' }}>
          <button onClick={() => router.push(`/listing/${data.id}`)} style={{
            width: '100%', padding: '8px 0', borderRadius: 10,
            border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)',
            color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Открыть товар →
          </button>
        </div>
      )}

      {/* Время */}
      <div style={{
        padding: '0 12px 8px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 10, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
          {timeStr}
        </span>
        {deliveryStatus}
      </div>
    </div>
  )
}
