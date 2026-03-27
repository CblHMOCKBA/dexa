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

export const CARD_PREFIX = 'LISTING_CARD:'

export function encodeListingCard(data: ListingCardData): string {
  return CARD_PREFIX + JSON.stringify(data)
}

export function decodeListingCard(text: string): ListingCardData | null {
  if (!text.startsWith(CARD_PREFIX)) return null
  try { return JSON.parse(text.slice(CARD_PREFIX.length)) } catch { return null }
}

type Props = {
  data: ListingCardData
  currentUserId: string
  chatId?: string
  isOwn: boolean
  timeStr: string
  deliveryStatus?: React.ReactNode
}

export default function ListingCardMessage({ data, currentUserId, chatId, isOwn, timeStr, deliveryStatus }: Props) {
  const router = useRouter()
  const [orderLoading, setOrderLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSeller = currentUserId === data.seller_id
  const canAct   = !isOwn && !isSeller && data.status === 'active'

  async function createOrder() {
    setOrderLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      // Используем существующий chatId если есть, иначе создаём
      let resolvedChatId = chatId
      if (!resolvedChatId) {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: data.id, seller_id: data.seller_id }),
        })
        const json = await res.json()
        if (!res.ok || !json.id) throw new Error(json.error ?? 'Не удалось создать чат')
        resolvedChatId = json.id
      }

      const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
        listing_id:    data.id,
        chat_id:       resolvedChatId,
        buyer_id:      user.id,
        seller_id:     data.seller_id,
        quantity:      1,
        total_price:   data.price,
        timer_minutes: 30,
      }).select('id').single()
      if (orderErr) throw new Error(orderErr.message)

      // Системное сообщение в чат
      await supabase.from('messages').insert({
        chat_id: resolvedChatId,
        sender_id: user.id,
        text: `SYSTEM:ORDER_CREATED:${(orderData as {id:string}).id}:${data.price.toLocaleString('ru-RU')}:${data.title}`,
      })

      setDone(true)
      setTimeout(() => router.push('/orders'), 600)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setOrderLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: isOwn ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      width: 250,
    }}>
      {/* Шапка */}
      <div style={{
        background: isOwn ? '#2AABEE' : '#EBF2FF',
        padding: '10px 14px 8px',
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: isOwn ? 'rgba(255,255,255,0.75)' : '#1249A8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📦 Товар
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: isOwn ? 'white' : '#1A1C21', lineHeight: 1.3, marginBottom: 2 }}>
          {data.title}
        </p>
        {(data.brand || data.model) && (
          <p style={{ fontSize: 12, color: isOwn ? 'rgba(255,255,255,0.7)' : '#9498AB' }}>
            {[data.brand, data.model].filter(Boolean).join(' ')}
          </p>
        )}
      </div>

      {/* Цена + статус */}
      <div style={{ padding: '10px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#1E6FEB', fontFamily: 'var(--font-mono)', margin: 0 }}>
          {data.price.toLocaleString('ru-RU')} ₽
        </p>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: data.condition === 'new' ? '#E6F9F3' : '#FFF4E0',
            color: data.condition === 'new' ? '#006644' : '#7A4F00',
          }}>
            {data.condition === 'new' ? 'Новый' : 'Б/У'}
          </span>
          {data.status !== 'active' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F2F3F5', color: '#9498AB' }}>
              {data.status === 'sold' ? 'Продан' : 'Бронь'}
            </span>
          )}
        </div>
      </div>

      {/* Кнопки — только для покупателя */}
      {canAct && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && <p style={{ fontSize: 11, color: '#E8251F', textAlign: 'center', margin: 0 }}>{error}</p>}

          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 13, fontWeight: 700, color: '#006644' }}>
              ✓ Ордер создан
            </div>
          ) : (
            <>
              <button onClick={createOrder} disabled={orderLoading} style={{
                width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                background: '#1E6FEB', color: 'white', fontSize: 13, fontWeight: 700,
                cursor: orderLoading ? 'not-allowed' : 'pointer', opacity: orderLoading ? 0.7 : 1,
              }}>
                {orderLoading ? '...' : '🔒 Забронировать'}
              </button>
              <button onClick={() => router.push(`/listing/${data.id}`)} style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1.5px solid #E0E1E6', background: 'white',
                color: '#5A5E72', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                👁 Смотреть товар
              </button>
            </>
          )}
        </div>
      )}

      {/* Время */}
      <div style={{ padding: '4px 12px 8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 10, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>{timeStr}</span>
        {deliveryStatus}
      </div>
    </div>
  )
}
