'use client'

import { useState, useEffect } from 'react'
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

  // Dexa profile linking
  const [showLinkSheet, setShowLinkSheet] = useState(false)
  const [linkSearch, setLinkSearch]       = useState('')
  const [linkResults, setLinkResults]     = useState<{ id: string; name: string; location: string | null; rating: number }[]>([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [linking, setLinking]             = useState(false)
  const [linkedProfile, setLinkedProfile] = useState<{ id: string; name: string; location: string | null; rating: number } | null>(null)
  const [chatLoading, setChatLoading]     = useState(false)

  // Загружаем привязанный профиль при монте
  useEffect(() => {
    if (!counterparty.dexa_profile_id) return
    const supabase = createClient()
    supabase.from('profiles')
      .select('id, name, location, rating')
      .eq('id', counterparty.dexa_profile_id)
      .single()
      .then(({ data }) => { if (data) setLinkedProfile(data) })
  }, [counterparty.dexa_profile_id])

  async function searchDexaUsers() {
    if (!linkSearch.trim()) return
    setLinkSearching(true)
    const supabase = createClient()
    const { data } = await supabase.from('profiles')
      .select('id, name, location, rating')
      .neq('id', currentUserId)
      .ilike('name', `%${linkSearch.trim()}%`)
      .limit(10)
    setLinkResults(data ?? [])
    setLinkSearching(false)
  }

  async function linkProfile(profileId: string) {
    setLinking(true)
    const supabase = createClient()
    const { error } = await supabase.from('counterparties')
      .update({ dexa_profile_id: profileId })
      .eq('id', counterparty.id)
    if (!error) {
      const profile = linkResults.find(r => r.id === profileId)
      if (profile) setLinkedProfile(profile)
      setShowLinkSheet(false)
    }
    setLinking(false)
  }

  async function unlinkProfile() {
    const supabase = createClient()
    await supabase.from('counterparties')
      .update({ dexa_profile_id: null })
      .eq('id', counterparty.id)
    setLinkedProfile(null)
  }

  async function goChat() {
    if (!linkedProfile || chatLoading) return
    setChatLoading(true)
    // Нужен листинг для чата — ищем последний активный у этого продавца
    const supabase = createClient()
    const { data: listing } = await supabase.from('listings')
      .select('id, seller_id')
      .eq('seller_id', linkedProfile.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (listing) {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, seller_id: listing.seller_id }),
      })
      const data = await res.json()
      if (data.id) { setChatLoading(false); router.push(`/chat/${data.id}`); return }
    }

    // Fallback — ищем существующий чат с этим человеком
    const { data: existingChat } = await supabase.from('chats')
      .select('id')
      .or(
        `and(buyer_id.eq.${currentUserId},seller_id.eq.${linkedProfile.id}),and(buyer_id.eq.${linkedProfile.id},seller_id.eq.${currentUserId})`
      )
      .limit(1)
      .maybeSingle()

    if (existingChat) {
      router.push(`/chat/${existingChat.id}`)
    } else {
      router.push('/chat')
    }
    setChatLoading(false)
  }

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

        {/* Привязка к Dexa */}
        {!isCourier && (
          linkedProfile ? (
            <div style={{ background: '#F8F9FF', border: '1.5px solid #C5D9F5', borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EBF2FF', color: '#1249A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {linkedProfile.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>{linkedProfile.name}</p>
                  <span style={{ fontSize: 9, background: '#1E6FEB', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>DEXA</span>
                </div>
                {linkedProfile.location && <p style={{ fontSize: 12, color: '#9498AB' }}>{linkedProfile.location}</p>}
                {linkedProfile.rating > 0 && <p style={{ fontSize: 11, color: '#F0B90B', marginTop: 1 }}>★ {linkedProfile.rating.toFixed(1)}</p>}
              </div>
              <button onClick={unlinkProfile} title="Отвязать" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#FFEBEA', color: '#E8251F', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowLinkSheet(true)} style={{
              width: '100%', padding: '11px 14px', borderRadius: 12, marginBottom: 14,
              border: '1.5px dashed #C5D9F5', background: 'transparent',
              color: '#1249A8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Привязать к аккаунту Dexa
            </button>
          )
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
          {linkedProfile && (
            <button onClick={goChat} disabled={chatLoading} style={{
              flex: 1, padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: '#fff', color: chatLoading ? '#9498AB' : '#1A1C21', border: '1.5px solid #E0E1E6', cursor: 'pointer',
            }}>
              {chatLoading ? '...' : '💬 Написать'}
            </button>
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

      {/* Привязка к Dexa — поиск */}
      {showLinkSheet && (
        <>
          <div onClick={() => setShowLinkSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 20px', maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            animation: 'slide-up 0.25s var(--spring-smooth) both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ width: 36, height: 4, background: '#E0E1E6', borderRadius: 2 }} />
            </div>

            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>Найти в Dexa</p>
            <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 14 }}>Поиск по имени среди пользователей</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchDexaUsers()}
                placeholder="Имя пользователя..."
                autoFocus
                style={{
                  flex: 1, background: '#F2F3F5', border: '1.5px solid transparent',
                  borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#1A1C21',
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#1E6FEB' }}
                onBlur={e => { e.target.style.borderColor = 'transparent' }}
              />
              <button onClick={searchDexaUsers} disabled={linkSearching || !linkSearch.trim()} style={{
                padding: '0 16px', borderRadius: 12, border: 'none',
                background: linkSearch.trim() ? '#1E6FEB' : '#E0E1E6',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}>
                {linkSearching ? '...' : '🔍'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
              {linkResults.length === 0 && !linkSearching && linkSearch.trim() && (
                <p style={{ textAlign: 'center', color: '#9498AB', padding: '20px 0', fontSize: 14 }}>
                  Не найдено
                </p>
              )}
              {linkResults.map(p => (
                <button key={p.id} onClick={() => linkProfile(p.id)} disabled={linking} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px', borderRadius: 12, border: '1.5px solid #E0E1E6',
                  background: '#fff', cursor: 'pointer', marginBottom: 8, textAlign: 'left',
                  transition: 'all 0.12s',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, background: '#EBF2FF', color: '#1249A8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, flexShrink: 0,
                  }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>{p.name}</p>
                    {p.location && <p style={{ fontSize: 12, color: '#9498AB' }}>{p.location}</p>}
                  </div>
                  {p.rating > 0 && (
                    <span style={{ fontSize: 11, color: '#F0B90B', fontWeight: 700, flexShrink: 0 }}>★ {p.rating.toFixed(1)}</span>
                  )}
                  <span style={{ fontSize: 12, color: '#1E6FEB', fontWeight: 700, flexShrink: 0 }}>
                    Привязать →
                  </span>
                </button>
              ))}
            </div>

            <button onClick={() => setShowLinkSheet(false)} style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none',
              background: '#F2F3F5', color: '#5A5E72', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Закрыть
            </button>
          </div>
        </>
      )}
    </div>
  )
}
