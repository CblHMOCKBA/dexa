'use client'

import Link from 'next/link'
import type { Order, OrderStatus } from '@/types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:     'Ожидает',
  confirmed:   'Подтверждён',
  in_delivery: 'В доставке',
  completed:   'Завершён',
  cancelled:   'Отменён',
}

function SkeletonOrder() {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 6 }}/>
        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 6 }}/>
      </div>
      <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 8 }}/>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 4, borderRadius: 2 }}/>)}
      </div>
    </div>
  )
}

export default function OrdersClient({
  orders,
  currentUserId,
}: {
  orders: Order[]
  currentUserId: string
}) {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      <div className="page-header pt-safe">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Мои сделки</h1>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: '#EBF2FF' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="1.8">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4"/>
            </svg>
          </div>
          <p className="empty-state-title">Нет сделок</p>
          <p className="empty-state-sub">Нажми «Написать» на карточку товара чтобы начать переговоры</p>
        </div>
      ) : (
        <div className="stagger" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => {
            const isBuyer    = currentUserId === order.buyer_id
            const partner    = isBuyer ? order.seller : order.buyer
            const displayPrice = order.counter_status === 'accepted' && order.counter_price
              ? order.counter_price : order.total_price
            const stepIdx = ['pending','confirmed','in_delivery','completed'].indexOf(order.status)

            return (
              // КЛЮЧЕВОЕ: вся карточка — ссылка на экран ордера
              <Link key={order.id} href={`/orders/${order.id}`} className="press-card" style={{ textDecoration: 'none', display: 'block' }}>
                <div className="card-press" style={{ padding: '14px 16px' }}>
                  {/* Шапка */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className={`badge badge-${order.status}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                    <span style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>

                  {/* Товар + цена */}
                  {order.listing && (
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', marginBottom: 4, lineHeight: 1.3 }}>
                      {order.listing.title}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>
                      {displayPrice.toLocaleString('ru-RU')} ₽
                    </span>
                    <span style={{ fontSize: 12, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
                      · {order.quantity} шт
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: isBuyer ? '#1249A8' : '#006644',
                      background: isBuyer ? '#EBF2FF' : '#E6F9F3',
                      padding: '2px 8px', borderRadius: 5,
                    }}>
                      {isBuyer ? 'Покупка' : 'Продажа'}
                    </span>
                  </div>

                  {/* Партнёр */}
                  {partner && (
                    <p style={{ fontSize: 13, color: '#5A5E72', marginBottom: 10 }}>
                      {isBuyer ? 'Продавец' : 'Покупатель'}:{' '}
                      <span style={{ fontWeight: 600, color: '#1A1C21' }}>{partner.name}</span>
                      {partner.location && <span style={{ color: '#9498AB' }}> · {partner.location}</span>}
                    </p>
                  )}

                  {/* Мини прогресс */}
                  {order.status !== 'cancelled' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {(['pending','confirmed','in_delivery','completed'] as OrderStatus[]).map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: i <= stepIdx ? '#1E6FEB' : '#E0E1E6',
                            transition: 'background 0.25s',
                          }}/>
                          {i < 3 && <div style={{ flex: 1, height: 2, background: i < stepIdx ? '#1E6FEB' : '#E0E1E6', margin: '0 2px' }}/>}
                        </div>
                      ))}
                      <svg style={{ marginLeft: 8, flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CDD0D8" strokeWidth="2.5">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  )}

                  {/* Бейдж торга */}
                  {order.counter_status === 'pending' && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8E0', borderRadius: 8, padding: '5px 10px', width: 'fit-content' }}>
                      <span style={{ fontSize: 12 }}>💬</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5E00' }}>
                        {order.counter_by === currentUserId ? 'Ждём ответа' : 'Требует ответа'}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
