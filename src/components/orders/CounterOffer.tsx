'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'

type Props = {
  order: Order
  currentUserId: string
  onUpdate: () => void
}

export default function CounterOffer({ order: initialOrder, currentUserId, onUpdate }: Props) {
  const [order, setOrder]       = useState<Order>(initialOrder)
  const [offerPrice, setOfferPrice] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showInput, setShowInput] = useState(false)

  // Realtime подписка на изменения этого ордера
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`order-${initialOrder.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${initialOrder.id}`,
      }, payload => {
        setOrder(prev => ({ ...prev, ...(payload.new as Partial<Order>) }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialOrder.id])

  // Синхронизируем когда родитель обновляет prop
  useEffect(() => { setOrder(initialOrder) }, [initialOrder])

  const isBuyer  = currentUserId === order.buyer_id
  const isSeller = currentUserId === order.seller_id

  // Мой ход — партнёр отправил counter, теперь я отвечаю
  const myTurn = order.counter_status === 'pending' && order.counter_by !== currentUserId

  // Я могу отправить counter: только если нет активного counter
  // и ордер в pending/confirmed И я не тот кто уже отправил
  const canSendCounter =
    !order.counter_status &&
    ['pending', 'confirmed'].includes(order.status) &&
    (order.counter_round ?? 0) < 3

  const maxRounds = 3
  const roundsLeft = maxRounds - (order.counter_round ?? 0)

  async function sendCounter() {
    const price = Number(offerPrice)
    if (!price || price <= 0 || loading) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('orders').update({
      counter_price:  price,
      counter_by:     currentUserId,
      counter_round:  (order.counter_round ?? 0) + 1,
      counter_status: 'pending',
    }).eq('id', order.id)

    if (!error) {
      setOfferPrice('')
      setShowInput(false)
      onUpdate()
    }
    setLoading(false)
  }

  async function respond(accept: boolean) {
    if (loading) return
    setLoading(true)
    const supabase = createClient()

    if (accept) {
      await supabase.from('orders').update({
        total_price:    order.counter_price!,
        counter_status: 'accepted',
        status:         'confirmed',
      }).eq('id', order.id)
    } else {
      await supabase.from('orders').update({
        counter_status: 'rejected',
      }).eq('id', order.id)
    }
    setLoading(false)
    onUpdate()
  }

  if (['completed', 'cancelled'].includes(order.status)) return null

  return (
    <div style={{ marginTop: 12 }}>

      {/* Активный counter-offer */}
      {order.counter_status === 'pending' && (
        <div style={{
          background: '#FFF8E0', border: '1.5px solid #F0B90B',
          borderRadius: 12, padding: '12px 14px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5E00' }}>
              {order.counter_by === currentUserId ? 'Вы предложили' : 'Встречное предложение'}
            </p>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)',
              background: '#F0B90B', color: '#fff', borderRadius: 5,
              padding: '2px 7px', fontWeight: 700,
            }}>
              Раунд {order.counter_round}/{maxRounds}
            </span>
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>
            {order.counter_price?.toLocaleString('ru-RU')} ₽
          </p>
          <p style={{ fontSize: 12, color: '#9498AB' }}>
            Исходная цена: {order.total_price.toLocaleString('ru-RU')} ₽
            {' · '}
            {order.counter_price! < order.total_price
              ? <span style={{ color: '#00B173', fontWeight: 600 }}>
                  -{((1 - order.counter_price! / order.total_price) * 100).toFixed(1)}%
                </span>
              : <span style={{ color: '#E8251F', fontWeight: 600 }}>
                  +{((order.counter_price! / order.total_price - 1) * 100).toFixed(1)}%
                </span>
            }
          </p>

          {/* Кнопки ответа — только если мой ход */}
          {myTurn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => respond(true)} disabled={loading} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: '#00B173', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                ✓ Принять
              </button>
              {roundsLeft > 0 && (
                <button onClick={() => setShowInput(true)} disabled={loading} style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: '#FFF4E0', color: '#7A4F00',
                  border: '1.5px solid #F5A623',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  ↔ Встречная
                </button>
              )}
              <button onClick={() => respond(false)} disabled={loading} style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#FFEBEA', color: '#E8251F',
                border: '1.5px solid #FFCDD0',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                ✕
              </button>
            </div>
          )}

          {!myTurn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5A623', animation: 'pulse-dot 1.5s infinite' }}/>
              <p style={{ fontSize: 12, color: '#9498AB' }}>Ожидаем ответа партнёра...</p>
            </div>
          )}
        </div>
      )}

      {/* Форма ввода своей цены */}
      {showInput && (
        <div style={{
          background: '#F2F3F5', borderRadius: 12, padding: '12px 14px',
          marginBottom: 10, border: '1.5px solid #E0E1E6',
          animation: 'fade-up 0.18s ease both',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#5A5E72', marginBottom: 8 }}>
            Ваша цена · осталось раундов: {roundsLeft}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="number"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
                placeholder={String(order.total_price)}
                className="input"
                style={{ paddingRight: 32 }}
                autoFocus
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9498AB', fontSize: 14, pointerEvents: 'none' }}>₽</span>
            </div>
            <button onClick={sendCounter} disabled={!offerPrice || loading} style={{
              padding: '0 18px', borderRadius: 12,
              background: offerPrice ? '#F0B90B' : '#E0E1E6',
              color: offerPrice ? '#7A5E00' : '#9498AB',
              border: 'none', fontSize: 14, fontWeight: 700,
              cursor: offerPrice ? 'pointer' : 'not-allowed',
              transition: 'all 0.12s',
            }}>
              {loading ? '...' : 'Отправить'}
            </button>
            <button onClick={() => { setShowInput(false); setOfferPrice('') }} style={{
              padding: '0 14px', borderRadius: 12,
              background: '#fff', border: '1.5px solid #E0E1E6',
              color: '#5A5E72', cursor: 'pointer', fontSize: 16,
            }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Кнопка предложить цену (первый раунд) */}
      {canSendCounter && !showInput && (
        <button onClick={() => setShowInput(true)} style={{
          width: '100%', padding: '10px', borderRadius: 10,
          background: '#FFF8E0', color: '#7A5E00',
          border: '1.5px dashed #F0B90B',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.12s',
        }}>
          <span style={{ fontSize: 16 }}>💬</span>
          Предложить свою цену
        </button>
      )}

      {/* Итог торга */}
      {order.counter_status === 'accepted' && (
        <div style={{
          background: '#E6F9F3', border: '1.5px solid #00B173',
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🤝</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#006644' }}>Цена согласована</p>
            <p style={{ fontSize: 12, color: '#009963', fontFamily: 'var(--font-mono)' }}>
              {order.counter_price?.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
      )}

      {/* Отклонено */}
      {order.counter_status === 'rejected' && (
        <div style={{
          background: '#F2F3F5', border: '1px solid #E0E1E6',
          borderRadius: 10, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🚫</span>
          <p style={{ fontSize: 13, color: '#9498AB' }}>
            Предложение отклонено
            {roundsLeft > 0 ? ' · можно предложить снова' : ' · раунды исчерпаны'}
          </p>
        </div>
      )}
    </div>
  )
}
