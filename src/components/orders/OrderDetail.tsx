'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

export default function OrderDetail({
  order,
  initialEvents,
  currentUserId,
}: {
  order: Order & { events?: OrderEvent[] }
  initialEvents: OrderEvent[]
  currentUserId: string
}) {
  const router  = useRouter()
  const isBuyer  = currentUserId === order.buyer_id
  const isSeller = currentUserId === order.seller_id
  // Ручная сделка — buyer = seller = currentUser, показываем контрагента
  const isManual = order.buyer_id === order.seller_id && order.buyer_id === currentUserId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counterparty = (order as any).counterparty
  const partner  = isManual
    ? null
    : (isBuyer ? order.seller : order.buyer)
  const myApproved = isBuyer ? order.buyer_approved : order.seller_approved
  const stepIdx  = STEPS.indexOf(order.status)
  const displayPrice = order.counter_status === 'accepted' && order.counter_price
    ? order.counter_price : order.total_price

  async function update(patch: Partial<Order>) {
    const supabase = createClient()
    await supabase.from('orders').update(patch).eq('id', order.id)
    router.refresh()
  }

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
    <div style={{ padding: '16px', paddingBottom: 'calc(100px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Статус-карточка */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <span className={`badge badge-${order.status}`} style={{ fontSize: 13, padding: '5px 12px' }}>
            {STATUS_LABEL[order.status]}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <OrderTimer
              createdAt={order.created_at}
              timerMinutes={order.timer_minutes ?? 30}
              orderStatus={order.status}
              onExpire={() => update({ status: 'cancelled' })}
            />
          </div>
        </div>

        {/* Товар */}
        {order.listing && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Товар</p>
            <p style={{ fontWeight: 700, fontSize: 17, color: '#1A1C21', lineHeight: 1.3 }}>
              {order.listing.title}
            </p>
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

      {/* Торг */}
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

      {/* Кнопки действий */}
      {!['completed', 'cancelled'].includes(order.status) && (
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Действия
          </p>
          {order.status === 'pending' && isSeller && !order.counter_status && (
            <button onClick={() => update({ status: 'confirmed' })} className="btn-primary">
              ✓ Подтвердить бронь
            </button>
          )}
          {order.status === 'confirmed' && isSeller && (
            <button onClick={() => update({ status: 'in_delivery' })} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
              borderRadius: 12, border: '1.5px solid #E0E1E6', background: '#fff',
              color: '#1A1C21', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              🚚 Передать курьеру
            </button>
          )}
          {order.status === 'in_delivery' && !myApproved && (
            <button onClick={approve} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
              borderRadius: 12, border: 'none', background: '#00B173',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              ✓ Подтвердить получение
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
  )
}
