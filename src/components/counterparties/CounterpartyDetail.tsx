'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Counterparty, Payment, Order } from '@/types'
import AddPaymentSheet from './AddPaymentSheet'

const TYPE_LABEL: Record<string, string> = {
  supplier: 'Поставщик',
  buyer:    'Покупатель',
  both:     'Оба',
  courier:  'Курьер / Сотрудник',
}
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  supplier: { bg: '#EBF2FF', color: '#1249A8' },
  buyer:    { bg: '#E6F9F3', color: '#006644' },
  both:     { bg: '#F0E8FF', color: '#5B00CC' },
  courier:  { bg: '#FFF4E0', color: '#7A4F00' },
}
const METHOD_ICONS: Record<string, string> = {
  cash: '💵', transfer: '📱', crypto: '₿', other: '📝',
}

function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60)   return `${m}м назад`
  if (m < 1440) return `${Math.floor(m / 60)}ч назад`
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

type Props = {
  counterparty: Counterparty
  orders: Order[]
  payments: Payment[]
  balance: number
  currentUserId: string
}

export default function CounterpartyDetail({
  counterparty, orders, payments: initPayments, balance: initBalance, currentUserId,
}: Props) {
  const router = useRouter()
  const [payments, setPayments]       = useState<Payment[]>(initPayments)
  const [balance]                     = useState(initBalance)
  const [tab, setTab]                 = useState<'deals' | 'payments'>('deals')
  const [showPayment, setShowPayment] = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [deleting, setDeleting]       = useState(false)

  // Safe fallback for unknown types
  const typeKey = counterparty.type ?? 'buyer'
  const tc = TYPE_COLOR[typeKey] ?? TYPE_COLOR['buyer']
  const isCourier = typeKey === 'courier'

  async function deleteCounterparty() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('payments').delete().eq('counterparty_id', counterparty.id)
    await supabase.from('counterparties').delete().eq('id', counterparty.id)
    router.push('/counterparties')
    router.refresh()
  }

  function onPaymentAdded() {
    setShowPayment(false)
    router.refresh()
  }

  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + (o.counter_status === 'accepted' && o.counter_price
      ? o.counter_price : o.total_price), 0)

  const isOverLimit = counterparty.credit_limit > 0 &&
    Math.abs(Math.min(0, balance)) > counterparty.credit_limit

  return (
    <div style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Hero карточка */}
      <div style={{ background: '#fff', padding: '20px 16px', borderBottom: '1px solid #F0F1F4' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, flexShrink: 0,
            background: tc.bg, color: tc.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
          }}>
            {isCourier ? '🚚' : (counterparty.name?.[0] ?? '?').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>{counterparty.name}</h1>
              <span style={{
                fontSize: 10, background: tc.bg, color: tc.color,
                borderRadius: 5, padding: '2px 7px', fontWeight: 700, flexShrink: 0,
              }}>
                {TYPE_LABEL[typeKey] ?? typeKey}
              </span>
            </div>
            {counterparty.company && (
              <p style={{ fontSize: 14, color: '#5A5E72', marginBottom: 2 }}>{counterparty.company}</p>
            )}
            {counterparty.phone && (
              <a href={`tel:${counterparty.phone}`} style={{ fontSize: 14, color: '#1E6FEB', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                {counterparty.phone}
              </a>
            )}
          </div>
          <Link href={`/counterparties/${counterparty.id}/edit`}>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #E0E1E6', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5A5E72" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </Link>
        </div>

        {/* Предупреждение о превышении лимита */}
        {isOverLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFEBEA', border: '1.5px solid #E8251F', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#A8170F' }}>Превышен кредитный лимит</p>
              <p style={{ fontSize: 11, color: '#C8392B' }}>
                Долг {Math.abs(balance).toLocaleString('ru-RU')} ₽ при лимите {counterparty.credit_limit.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        )}

        {/* Статы — скрываем для курьеров */}
        {!isCourier && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#F0F1F4', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            {[
              { label: 'Баланс', val: balance === 0 ? '—' : `${balance > 0 ? '+' : ''}${balance.toLocaleString('ru-RU')} ₽`, color: balance > 0 ? '#00B173' : balance < 0 ? '#E8251F' : '#9498AB' },
              { label: 'Сделок', val: orders.filter(o => o.status === 'completed').length, color: '#1A1C21' },
              { label: 'Оборот', val: totalRevenue > 0 ? `${Math.round(totalRevenue / 1000)}к ₽` : '—', color: '#1A1C21' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', padding: '11px 8px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</p>
                <p style={{ fontSize: 10, color: '#9498AB', marginTop: 1 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Условия */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {counterparty.discount_pct > 0 && (
            <span style={{ background: '#FFF8E0', color: '#7A5E00', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
              🏷️ Скидка {counterparty.discount_pct}%
            </span>
          )}
          {counterparty.credit_limit > 0 && (
            <span style={{ background: '#F2F3F5', color: '#5A5E72', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              💳 Лимит {counterparty.credit_limit.toLocaleString('ru-RU')} ₽
            </span>
          )}
          {counterparty.payment_delay_days > 0 && (
            <span style={{ background: '#F2F3F5', color: '#5A5E72', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              ⏱ Отсрочка {counterparty.payment_delay_days} дн.
            </span>
          )}
          {counterparty.inn && (
            <span style={{ background: '#F2F3F5', color: '#9498AB', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              ИНН {counterparty.inn}
            </span>
          )}
          {counterparty.tags?.map(tag => (
            <span key={tag} style={{ background: '#F2F3F5', color: '#5A5E72', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
              {tag}
            </span>
          ))}
        </div>

        {counterparty.notes && (
          <p style={{ fontSize: 14, color: '#5A5E72', lineHeight: 1.6, background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            {counterparty.notes}
          </p>
        )}

        {/* Действия — не для курьеров платёж */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isCourier && (
            <button onClick={() => setShowPayment(true)} style={{
              flex: 1, padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: '#1E6FEB', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              + Платёж
            </button>
          )}
          {counterparty.dexa_profile_id && (
            <Link href="/chat" style={{ flex: 1 }}>
              <button style={{
                width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: '#fff', color: '#1A1C21', border: '1.5px solid #E0E1E6', cursor: 'pointer',
              }}>
                💬 Написать
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Табы — не для курьеров */}
      {!isCourier && (
        <>
          <div style={{ background: '#fff', borderBottom: '1px solid #F0F1F4', display: 'flex', paddingLeft: 16 }}>
            {(['deals', 'payments'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '12px 16px', fontSize: 14, fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? '#1E6FEB' : '#9498AB',
                borderBottom: tab === t ? '2px solid #1E6FEB' : '2px solid transparent',
                marginBottom: -1,
              }}>
                {t === 'deals'
                  ? `Сделки${orders.length > 0 ? ` · ${orders.length}` : ''}`
                  : `Платежи${payments.length > 0 ? ` · ${payments.length}` : ''}`
                }
              </button>
            ))}
          </div>

          {tab === 'deals' && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9498AB', padding: '40px 0', fontSize: 14 }}>
                  Нет сделок с этим контрагентом
                </p>
              ) : orders.map(o => {
                const price = o.counter_status === 'accepted' && o.counter_price ? o.counter_price : o.total_price
                const isBuyer = currentUserId === o.buyer_id
                return (
                  <Link key={o.id} href={`/orders/${o.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card-press" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>
                          {(o as { listing?: { title?: string } }).listing?.title ?? 'Товар'}
                        </p>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>
                          {price.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge badge-${o.status}`} style={{ fontSize: 11 }}>
                          {o.status === 'completed' ? 'Завершён' : o.status === 'cancelled' ? 'Отменён' : 'В процессе'}
                        </span>
                        <span style={{ fontSize: 11, background: isBuyer ? '#EBF2FF' : '#E6F9F3', color: isBuyer ? '#1249A8' : '#006644', borderRadius: 5, padding: '1px 6px', fontWeight: 600 }}>
                          {isBuyer ? 'Покупка' : 'Продажа'}
                        </span>
                        <span style={{ fontSize: 11, color: '#9498AB', marginLeft: 'auto' }}>{ago(o.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {tab === 'payments' && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: '#9498AB', marginBottom: 16, fontSize: 14 }}>Нет платежей</p>
                  <button onClick={() => setShowPayment(true)} style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    + Добавить платёж
                  </button>
                </div>
              ) : payments.map(p => (
                <div key={p.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{METHOD_ICONS[p.method] ?? '📝'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: p.direction === 'in' ? '#00B173' : '#E8251F' }}>
                        {p.direction === 'in' ? '+' : '−'}{p.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <span style={{ fontSize: 11, color: '#9498AB', flexShrink: 0 }}>{ago(p.created_at)}</span>
                    </div>
                    {p.note && <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>{p.note}</p>}
                    <p style={{ fontSize: 11, color: '#CDD0D8', marginTop: 2 }}>
                      {p.direction === 'in' ? 'Получено' : 'Выплачено'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Для курьера — подсказка редактировать */}
      {isCourier && (
        <div style={{ padding: '16px' }}>
          <div style={{ background: '#FFF4E0', borderRadius: 14, padding: '16px', border: '1px solid #F5A623', textAlign: 'center' }}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>🚚</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#7A4F00', marginBottom: 6 }}>Сотрудник / Курьер</p>
            <p style={{ fontSize: 13, color: '#9A6800', marginBottom: 14, lineHeight: 1.5 }}>
              Добавь телефон и заметки через редактирование
            </p>
            <Link href={`/counterparties/${counterparty.id}/edit`}>
              <button style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ✏️ Редактировать
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Удалить — с подтверждением */}
      <div style={{ padding: '8px 16px 0' }}>
        {confirmDel ? (
          <div style={{ background: '#FFEBEA', borderRadius: 14, padding: '14px', border: '1px solid #FFCDD0' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#A8170F', textAlign: 'center', marginBottom: 6 }}>
              Удалить {TYPE_LABEL[typeKey] ?? 'контрагента'}?
            </p>
            <p style={{ fontSize: 11, color: '#9498AB', textAlign: 'center', marginBottom: 12 }}>
              Все платежи с ним тоже удалятся
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #E0E1E6', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={deleteCounterparty} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#E8251F', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? '...' : 'Удалить'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: 'transparent', color: '#CDD0D8',
            border: '1px dashed #E0E1E6', cursor: 'pointer', fontSize: 13,
          }}>
            Удалить контрагента
          </button>
        )}
      </div>

      {showPayment && (
        <AddPaymentSheet
          counterpartyId={counterparty.id}
          onClose={() => setShowPayment(false)}
          onSuccess={onPaymentAdded}
        />
      )}
    </div>
  )
}
