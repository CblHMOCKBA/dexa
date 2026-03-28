'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import type { Order, OrderStatus, OrderEvent } from '@/types'
import OrderTimer from './OrderTimer'
import CounterOffer from './CounterOffer'
import OrderActivity from './OrderActivity'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:     'Ожидает подтверждения',
  confirmed:   'Подтверждён',
  in_delivery: 'В доставке',
  completed:   'Завершён',
  cancelled:   'Отменён',
}
const STEPS: OrderStatus[] = ['pending', 'confirmed', 'in_delivery', 'completed']

// ─── Courier Handoff Sheet ────────────────────────────────────────────────────
function CourierSheet({
  orderId,
  onClose,
  onDone,
}: {
  orderId: string
  onClose: () => void
  onDone: () => void
}) {
  const [courierName, setCourierName] = useState('')
  const [address, setAddress]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function submit() {
    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('orders').update({
      status:           'in_delivery',
      courier_note:     courierName.trim() || null,
      delivery_address: address.trim() || null,
    }).eq('id', orderId)

    if (err) { setError(err.message); setSaving(false); return }

    await supabase.from('order_events').insert({
      order_id:   orderId,
      event_type: 'delivery_started',
      payload:    { courier: courierName.trim(), address: address.trim() },
    })

    onDone()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 200, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 20px 24px',
        animation: 'slide-up 0.25s var(--spring-smooth) both',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 16 }}>
          <div style={{ width: 36, height: 4, background: '#E0E1E6', borderRadius: 2 }} />
        </div>

        <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>🚚 Передать курьеру</p>
        <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 20 }}>Заполни данные — покупатель увидит статус</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Имя курьера</p>
            <input
              value={courierName} onChange={e => setCourierName(e.target.value)}
              placeholder="Вася, Служба доставки..."
              style={{
                width: '100%', background: '#F2F3F5', border: '1.5px solid transparent',
                borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#1A1C21',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Адрес / комментарий</p>
            <textarea
              value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Павильон B-12, Горбушка"
              rows={2}
              style={{
                width: '100%', background: '#F2F3F5', border: '1.5px solid transparent',
                borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#1A1C21',
                outline: 'none', boxSizing: 'border-box', resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#E8251F', background: '#FFEBEA', borderRadius: 10, padding: '10px 12px' }}>
              {error}
            </p>
          )}

          <button onClick={submit} disabled={saving} style={{
            padding: '14px', borderRadius: 14, border: 'none',
            background: saving ? '#9498AB' : '#7B4FCC',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            transition: 'background 0.15s',
          }}>
            {saving ? 'Сохраняем...' : '🚚 Передать курьеру'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main OrderDetail ─────────────────────────────────────────────────────────
export default function OrderDetail({
  order: initialOrder,
  initialEvents,
  currentUserId,
}: {
  order: Order & { events?: OrderEvent[] }
  initialEvents: OrderEvent[]
  currentUserId: string
}) {
  const router = useRouter()

  // ── Local state для realtime ──
  const [order, setOrder] = useState(initialOrder)
  const [showCourierSheet, setShowCourierSheet] = useState(false)

  // Синхронизируем при server-side обновлении (router.refresh)
  useEffect(() => { setOrder(initialOrder) }, [initialOrder])

  // ── Realtime подписка на этот ордер ──
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`order-detail-${initialOrder.id}`)
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

  const isBuyer  = currentUserId === order.buyer_id
  const isSeller = currentUserId === order.seller_id
  const isManual = order.buyer_id === order.seller_id && order.buyer_id === currentUserId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counterparty = (order as any).counterparty
  const partner  = isManual ? null : (isBuyer ? order.seller : order.buyer)
  const stepIdx  = STEPS.indexOf(order.status)
  const displayPrice = order.counter_status === 'accepted' && order.counter_price
    ? order.counter_price : order.total_price

  const update = useCallback(async (patch: Partial<Order>) => {
    const supabase = createClient()
    await supabase.from('orders').update(patch).eq('id', order.id)
    // Realtime сам обновит стейт, router.refresh для серверных данных
    router.refresh()
  }, [order.id, router])

  async function approve() {
    const both = (isBuyer && order.seller_approved) || (isSeller && order.buyer_approved)
    await update({
      ...(isBuyer
        ? { buyer_approved: true, buyer_approved_at: new Date().toISOString() }
        : { seller_approved: true, seller_approved_at: new Date().toISOString() }),
      ...(both ? { status: 'completed' as OrderStatus } : {}),
    })
  }

  return (
    <>
      {showCourierSheet && (
        <CourierSheet
          orderId={order.id}
          onClose={() => setShowCourierSheet(false)}
          onDone={() => router.refresh()}
        />
      )}

      <div style={{ padding: '16px', paddingBottom: 'calc(100px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Статус-карточка */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <span className={`badge badge-${order.status}`} style={{ fontSize: 13, padding: '5px 12px' }}>
              {STATUS_LABEL[order.status]}
            </span>
            {/* Таймер — OrderTimer сам скрывается если status !== pending */}
            {!isManual && (
              <OrderTimer
                createdAt={order.created_at}
                timerMinutes={order.timer_minutes ?? 30}
                orderStatus={order.status}
                onExpire={() => update({ status: 'cancelled' })}
              />
            )}
          </div>

          {/* Товар */}
          {(order.listing || order.listing_id) && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Товар</p>
              <p style={{ fontWeight: 700, fontSize: 17, color: '#1A1C21', lineHeight: 1.3 }}>
                {order.listing?.title ?? 'Товар из склада'}
              </p>
              {order.listing?.brand && (
                <p style={{ fontSize: 13, color: '#9498AB', marginTop: 2 }}>{order.listing.brand}</p>
              )}
            </div>
          )}

          {/* Цена */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: '#1A1C21' }}>
              {displayPrice.toLocaleString('ru-RU')} ₽
            </p>
            {order.counter_status === 'accepted' && order.counter_price !== order.total_price && (
              <p style={{ fontSize: 14, color: '#9498AB', textDecoration: 'line-through', fontFamily: 'var(--font-mono)' }}>
                {order.total_price.toLocaleString('ru-RU')} ₽
              </p>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: (isManual || !isBuyer) ? '#006644' : '#1249A8',
              background: (isManual || !isBuyer) ? '#E6F9F3' : '#EBF2FF',
              padding: '3px 10px', borderRadius: 6 }}>
              {isManual ? 'Продажа' : isBuyer ? 'Покупка' : 'Продажа'} · {order.quantity} шт
            </span>
          </div>

          {/* Прогресс */}
          {order.status !== 'cancelled' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {STEPS.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      background: i <= stepIdx ? '#1E6FEB' : '#E0E1E6',
                      border: i === stepIdx ? '2px solid #1E6FEB' : 'none',
                      boxShadow: i === stepIdx ? '0 0 0 4px #EBF2FF' : 'none',
                      transition: 'all 0.25s',
                    }}/>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 2.5, margin: '0 3px', background: i < stepIdx ? '#1E6FEB' : '#E0E1E6', transition: 'background 0.3s' }}/>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                {STEPS.map((s, i) => (
                  <p key={s} style={{ fontSize: 9, color: i <= stepIdx ? '#1E6FEB' : '#9498AB', fontFamily: 'var(--font-mono)', fontWeight: 600, flex: 1, textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center' }}>
                    {s === 'pending' ? 'Создан' : s === 'confirmed' ? 'Подтверждён' : s === 'in_delivery' ? 'Доставка' : 'Готово'}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Курьер (если in_delivery и есть данные) */}
          {order.status === 'in_delivery' && (order.courier_note || order.delivery_address) && (
            <div style={{ background: '#F0E8FF', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🚚</span>
              <div>
                {order.courier_note && (
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#4A2F8A' }}>{order.courier_note}</p>
                )}
                {order.delivery_address && (
                  <p style={{ fontSize: 12, color: '#7B4FCC', marginTop: 2 }}>{order.delivery_address}</p>
                )}
              </div>
            </div>
          )}

          {/* Партнёр / Контрагент */}
          {(partner || (isManual && counterparty)) && (
            <div style={{ background: '#F2F3F5', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EBF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#1249A8', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {(isManual ? counterparty?.name : partner?.name)?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
                  {isManual ? 'Контрагент' : isBuyer ? 'Продавец' : 'Покупатель'}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>
                  {isManual ? counterparty?.name : partner?.name}
                </p>
                {(isManual ? counterparty?.company : partner?.location) && (
                  <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
                    {isManual ? counterparty?.company : partner?.location}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Торг — только для P2P сделок */}
        {!isManual && (
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
              Переговоры по цене
            </p>
            <CounterOffer
              order={order}
              currentUserId={currentUserId}
              onUpdate={() => router.refresh()}
            />
          </div>
        )}

        {/* Кнопки действий */}
        {!['completed', 'cancelled'].includes(order.status) && (
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              Действия
            </p>

            {/* pending: продавец подтверждает бронь */}
            {order.status === 'pending' && isSeller && !order.counter_status && (
              <button onClick={() => update({ status: 'confirmed', seller_approved: true, seller_approved_at: new Date().toISOString() })} className="btn-primary">
                ✓ Подтвердить бронь
              </button>
            )}

            {/* confirmed: продавец передаёт курьеру — открывает шит */}
            {order.status === 'confirmed' && isSeller && (
              <button onClick={() => setShowCourierSheet(true)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                borderRadius: 12, border: '1.5px solid #E0E1E6', background: '#fff',
                color: '#1A1C21', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>
                🚚 Передать курьеру
              </button>
            )}

            {/* in_delivery: продавец подтверждает отправку */}
            {order.status === 'in_delivery' && isSeller && !order.seller_approved && (
              <button onClick={() => update({ seller_approved: true, seller_approved_at: new Date().toISOString() })} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                borderRadius: 12, border: 'none', background: '#1E6FEB',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                📦 Подтвердить отправку товара
              </button>
            )}

            {order.status === 'in_delivery' && isSeller && order.seller_approved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#E6F9F3', borderRadius: 12 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#006644' }}>Отправка подтверждена · ждём покупателя</p>
              </div>
            )}

            {order.status === 'in_delivery' && isBuyer && !isManual && order.seller_approved && !order.buyer_approved && (
              <button onClick={() => update({ buyer_approved: true, buyer_approved_at: new Date().toISOString(), status: 'completed' })} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                borderRadius: 12, border: 'none', background: '#00B173',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                ✓ Подтвердить получение товара
              </button>
            )}

            {order.status === 'in_delivery' && isBuyer && !isManual && !order.seller_approved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F2F3F5', borderRadius: 12 }}>
                <span style={{ fontSize: 20 }}>⏳</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#5A5E72' }}>Ждём подтверждения отправки от продавца</p>
              </div>
            )}

            {/* Ручная сделка in_delivery */}
            {order.status === 'in_delivery' && isManual && (
              <button onClick={() => update({ buyer_approved: true, seller_approved: true, buyer_approved_at: new Date().toISOString(), seller_approved_at: new Date().toISOString(), status: 'completed' })} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
                borderRadius: 12, border: 'none', background: '#00B173',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                ✓ Закрыть сделку
              </button>
            )}

            {order.status === 'pending' && (
              <button onClick={() => update({ status: 'cancelled' })} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
                borderRadius: 12, border: '1.5px solid #FFCDD0', background: '#FFEBEA',
                color: '#E8251F', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                Отменить сделку
              </button>
            )}
          </div>
        )}

        {/* Лента активности */}
        <div className="card" style={{ padding: '16px' }}>
          <OrderActivity
            orderId={order.id}
            currentUserId={currentUserId}
            initialEvents={initialEvents}
          />
        </div>
      </div>
    </>
  )
}
