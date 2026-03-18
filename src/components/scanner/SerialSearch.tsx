'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'
import type { Counterparty } from '@/types'

type SerialItem = {
  id: string
  serial_number: string | null
  imei: string | null
  status: string
  acquired_price: number | null
  created_at: string
  listing: {
    id: string
    title: string
    brand: string | null
    price: number
    seller_id: string
  } | null
  order: {
    id: string
    total_price: number
    created_at: string
    buyer: { name: string; location: string | null } | null
  } | null
}

type PaymentMethod = 'cash' | 'transfer' | 'crypto' | 'other'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'В наличии',    color: '#006644', bg: '#E6F9F3' },
  reserved:  { label: 'Забронирован', color: '#7A4F00', bg: '#FFF4E0' },
  sold:      { label: 'Продан',        color: '#9498AB', bg: '#F2F3F5' },
  repair:    { label: 'В ремонте',     color: '#5B00CC', bg: '#F0E8FF' },
  returned:  { label: 'Возврат',       color: '#A8170F', bg: '#FFEBEA' },
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '💵 Наличные',
  transfer: '🏦 Перевод',
  crypto: '₿ Крипто',
  other: '📋 Другое',
}

export default function SerialSearch() {
  const [query, setQuery]             = useState('')
  const [result, setResult]           = useState<SerialItem | null>(null)
  const [loading, setLoading]         = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Форма сделки
  const [showDeal, setShowDeal]             = useState(false)
  const [dealPrice, setDealPrice]           = useState('')
  const [dealMethod, setDealMethod]         = useState<PaymentMethod>('cash')
  const [dealCounterparty, setDealCounterparty] = useState('')
  const [dealCourier, setDealCourier]       = useState('')
  const [dealNote, setDealNote]             = useState('')
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [dealing, setDealing]               = useState(false)
  const [dealDone, setDealDone]             = useState(false)
  const [dealError, setDealError]           = useState<string | null>(null)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (!showDeal || counterparties.length > 0) return
    const supabase = createClient()
    supabase.from('counterparties').select('*').order('name').then(({ data }) => {
      setCounterparties((data as Counterparty[]) ?? [])
    })
  }, [showDeal])

  async function search(value: string) {
    if (!value.trim()) return
    setLoading(true); setNotFound(false); setResult(null)
    setShowDeal(false); setDealDone(false); setDealError(null)

    const supabase = createClient()
    const q = value.trim().toUpperCase()

    const { data } = await supabase
      .from('serial_items')
      .select(`
        *,
        listing:listings(id, title, brand, price, seller_id),
        order:orders(
          id, total_price, created_at,
          buyer:profiles!orders_buyer_id_fkey(name, location)
        )
      `)
      .or(`serial_number.eq.${q},imei.eq.${q}`)
      .single()

    if (data) {
      const item = data as SerialItem
      setResult(item)
      setDealPrice(String(item.listing?.price ?? ''))
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  function handleScan(r: ScanResult) {
    setShowScanner(false)
    setQuery(r.value)
    search(r.value)
  }

  async function conductDeal() {
    if (!result || !currentUserId || !dealPrice) return
    setDealing(true); setDealError(null)

    const supabase = createClient()
    const price = parseInt(dealPrice.replace(/\D/g, ''))

    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          listing_id: result.listing?.id ?? null,
          chat_id: null,
          buyer_id: dealCounterparty || currentUserId,
          seller_id: currentUserId,
          quantity: 1,
          total_price: price,
          status: 'completed',
          courier_note: [
            dealCourier && `Курьер: ${dealCourier}`,
            dealNote,
          ].filter(Boolean).join(' | ') || null,
        })
        .select('id')
        .single()

      if (orderErr) throw orderErr

      await supabase
        .from('serial_items')
        .update({ status: 'sold', order_id: order.id })
        .eq('id', result.id)

      if (result.listing?.id) {
        const { data: listing } = await supabase
          .from('listings').select('quantity').eq('id', result.listing.id).single()
        const newQty = Math.max(0, (listing?.quantity ?? 1) - 1)
        await supabase.from('listings').update({
          quantity: newQty,
          status: newQty === 0 ? 'sold' : 'active',
        }).eq('id', result.listing.id)
      }

      if (dealCounterparty) {
        await supabase.from('payments').insert({
          counterparty_id: dealCounterparty,
          owner_id: currentUserId,
          amount: price,
          direction: 'in',
          method: dealMethod,
          order_id: order.id,
          note: dealNote || null,
        })
      }

      setDealDone(true)
      setShowDeal(false)
      setResult(prev => prev ? {
        ...prev, status: 'sold',
        order: { id: order.id, total_price: price, created_at: new Date().toISOString(), buyer: null },
      } : null)

    } catch (e: unknown) {
      setDealError(e instanceof Error ? e.message : 'Ошибка проведения сделки')
    } finally {
      setDealing(false)
    }
  }

  const st = result ? STATUS_LABEL[result.status] ?? STATUS_LABEL.available : null
  const priceNum = parseInt(dealPrice.replace(/\D/g, '') || '0')
  const listingPrice = result?.listing?.price ?? 0
  const priceDiff = listingPrice > 0 ? Math.round(((priceNum - listingPrice) / listingPrice) * 100) : 0

  return (
    <div>
      {/* Строка поиска */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query)}
          placeholder="Серийный номер или штрихкод..."
          className="input"
          style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
          autoCapitalize="characters"
        />
        <button onClick={() => setShowScanner(true)} style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: '#1E6FEB', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
            <rect x="7" y="7" width="10" height="10" rx="1"/>
          </svg>
        </button>
        <button onClick={() => search(query)} disabled={!query.trim() || loading}
          className="btn-primary" style={{ padding: '0 16px', minHeight: 48 }}>
          {loading ? '...' : 'Найти'}
        </button>
      </div>

      {/* Не найдено */}
      {notFound && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 32, marginBottom: 10 }}>🔍</p>
          <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Не найдено</p>
          <p style={{ fontSize: 14, color: '#9498AB' }}>«{query}» не зарегистрирован в Dexa</p>
        </div>
      )}

      {/* Сделка проведена */}
      {dealDone && (
        <div style={{
          background: '#E6F9F3', borderRadius: 16, padding: '20px',
          marginBottom: 16, textAlign: 'center',
        }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>✅</p>
          <p style={{ fontWeight: 700, fontSize: 17, color: '#006644', marginBottom: 4 }}>Сделка проведена</p>
          <p style={{ fontSize: 14, color: '#5A5E72' }}>
            {result?.listing?.title} — {priceNum.toLocaleString('ru-RU')} ₽
          </p>
        </div>
      )}

      {/* Карточка устройства */}
      {result && st && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 4 }}>Устройство</p>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.3 }}>
                  {result.listing?.title ?? 'Неизвестный товар'}
                </p>
                {result.listing?.brand && (
                  <p style={{ fontSize: 13, color: '#9498AB', marginTop: 2 }}>{result.listing.brand}</p>
                )}
                {result.listing?.price && (
                  <p style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1E6FEB', marginTop: 6 }}>
                    {result.listing.price.toLocaleString('ru-RU')} ₽
                  </p>
                )}
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {st.label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.serial_number && (
                <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 2 }}>Серийный номер</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>
                    {result.serial_number}
                  </p>
                </div>
              )}
              {result.imei && (
                <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 2 }}>IMEI</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>
                    {result.imei}
                  </p>
                </div>
              )}
            </div>

            {result.status === 'available' && !dealDone && (
              <button
                onClick={() => setShowDeal(v => !v)}
                style={{
                  marginTop: 14, width: '100%', minHeight: 50,
                  background: showDeal ? '#F2F3F5' : '#1E6FEB',
                  color: showDeal ? '#5A5E72' : 'white',
                  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {showDeal ? '✕ Свернуть' : '🤝 Провести сделку'}
              </button>
            )}
          </div>

          {/* Форма быстрой сделки */}
          {showDeal && result.status === 'available' && (
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
                Быстрая сделка
              </p>

              {/* Цена */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Цена продажи
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={dealPrice}
                    onChange={e => setDealPrice(e.target.value)}
                    placeholder="0"
                    type="number"
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, paddingRight: 48, color: '#1A1C21' }}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: '#9498AB' }}>₽</span>
                </div>
                {listingPrice > 0 && priceNum > 0 && (
                  <p style={{ fontSize: 12, color: priceDiff >= 0 ? '#006644' : '#A8170F', marginTop: 5 }}>
                    {priceDiff >= 0 ? '↑' : '↓'} {Math.abs(priceDiff)}% к прайсу ({listingPrice.toLocaleString('ru-RU')} ₽)
                  </p>
                )}
              </div>

              {/* Метод */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Метод оплаты
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => (
                    <button key={m} onClick={() => setDealMethod(m)} style={{
                      padding: '10px 12px', borderRadius: 10,
                      border: `2px solid ${dealMethod === m ? '#1E6FEB' : '#E0E1E6'}`,
                      background: dealMethod === m ? '#EBF2FF' : 'white',
                      color: dealMethod === m ? '#1249A8' : '#5A5E72',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Контрагент */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Покупатель
                </label>
                <select
                  value={dealCounterparty}
                  onChange={e => setDealCounterparty(e.target.value)}
                  className="input" style={{ fontSize: 15 }}
                >
                  <option value="">— Без контрагента —</option>
                  {counterparties.filter(c => c.type !== 'supplier').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` (${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Курьер */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Курьер (если нужен)
                </label>
                <input
                  value={dealCourier}
                  onChange={e => setDealCourier(e.target.value)}
                  placeholder="Имя или телефон"
                  className="input"
                />
              </div>

              {/* Комментарий */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Комментарий
                </label>
                <textarea
                  value={dealNote}
                  onChange={e => setDealNote(e.target.value)}
                  placeholder="Доп. информация..."
                  className="input" rows={2} style={{ resize: 'none' }}
                />
              </div>

              {/* Итог */}
              {priceNum > 0 && (
                <div style={{ background: '#F8F9FB', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  {dealCounterparty && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#9498AB' }}>Покупатель</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>
                        {counterparties.find(c => c.id === dealCounterparty)?.name ?? '—'}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#9498AB' }}>Итого</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#00B173', fontFamily: 'var(--font-mono)' }}>
                      {priceNum.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              )}

              {dealError && (
                <p style={{ fontSize: 13, color: '#A8170F', marginBottom: 12, textAlign: 'center' }}>{dealError}</p>
              )}

              <button
                onClick={conductDeal}
                disabled={!dealPrice || priceNum === 0 || dealing}
                style={{
                  width: '100%', minHeight: 52,
                  background: (!dealPrice || priceNum === 0 || dealing) ? '#9498AB' : '#00B173',
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: 16, fontWeight: 700,
                  cursor: dealing ? 'not-allowed' : 'pointer',
                }}
              >
                {dealing ? 'Проводим...' : `✓ Провести${priceNum > 0 ? ` · ${priceNum.toLocaleString('ru-RU')} ₽` : ''}`}
              </button>
            </div>
          )}

          {/* История устройства */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
              История устройства
            </p>
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: '#E0E1E6', borderRadius: 1 }}/>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
                <div style={{ position: 'absolute', left: -20, width: 14, height: 14, borderRadius: '50%', background: '#EBF2FF', border: '2px solid #1E6FEB', top: 2 }}/>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>Поступление на склад</p>
                  <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>
                    {new Date(result.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {result.acquired_price && (
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#5A5E72' }}>
                        {' · '}закуп {result.acquired_price.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {result.order && (
                <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -20, width: 14, height: 14, borderRadius: '50%', background: '#E6F9F3', border: '2px solid #00B173', top: 2 }}/>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>Продажа</p>
                    <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>
                      {new Date(result.order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {result.order.buyer && (
                      <p style={{ fontSize: 12, color: '#5A5E72', marginTop: 4 }}>
                        Покупатель: <span style={{ fontWeight: 600, color: '#1A1C21' }}>{result.order.buyer.name}</span>
                        {result.order.buyer.location && ` · ${result.order.buyer.location}`}
                      </p>
                    )}
                    <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00B173', marginTop: 4 }}>
                      {result.order.total_price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          mode="any"
          hint="Наведи на серийный номер или штрихкод"
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
