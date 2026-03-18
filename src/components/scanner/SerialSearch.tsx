'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'
import type { Counterparty } from '@/types'

// ─── Типы ─────────────────────────────────────────────────

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
    upc: string | null
  } | null
  order: {
    id: string
    total_price: number
    created_at: string
    buyer: { name: string; location: string | null } | null
  } | null
}

type UPCListing = {
  id: string
  title: string
  brand: string | null
  model: string | null
  price: number
  quantity: number
  status: string
  upc: string | null
  seller: { id: string; name: string; location: string | null } | null
  serial_items: { id: string; serial_number: string | null; imei: string | null; status: string }[]
}

type SearchMode = 'serial' | 'upc'
type PaymentMethod = 'cash' | 'transfer' | 'crypto' | 'other'

// ─── Константы ────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'В наличии',    color: '#006644', bg: '#E6F9F3' },
  reserved:  { label: 'Забронирован', color: '#7A4F00', bg: '#FFF4E0' },
  sold:      { label: 'Продан',        color: '#9498AB', bg: '#F2F3F5' },
  repair:    { label: 'В ремонте',     color: '#5B00CC', bg: '#F0E8FF' },
  returned:  { label: 'Возврат',       color: '#A8170F', bg: '#FFEBEA' },
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '💵 Наличные', transfer: '🏦 Перевод', crypto: '₿ Крипто', other: '📋 Другое',
}

// Определяем тип скана по значению
function detectMode(val: string): SearchMode {
  const clean = val.trim().replace(/\s/g, '')
  // UPC/EAN — только цифры, 8–14 символов (не считая IMEI = 15)
  if (/^\d{8,14}$/.test(clean)) return 'upc'
  return 'serial'
}

// ─── Главный компонент ────────────────────────────────────

export default function SerialSearch() {
  const [query, setQuery]             = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [searchMode, setSearchMode]   = useState<SearchMode | null>(null)

  // Результат S/N поиска (одно устройство)
  const [serialResult, setSerialResult] = useState<SerialItem | null>(null)

  // Результат UPC поиска (несколько листингов)
  const [upcResults, setUpcResults] = useState<UPCListing[]>([])

  // Форма быстрой сделки
  const [dealItem, setDealItem]             = useState<SerialItem | null>(null)
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

  // Загружаем контрагентов при открытии формы
  useEffect(() => {
    if (!dealItem || counterparties.length > 0) return
    const supabase = createClient()
    supabase.from('counterparties').select('*').order('name').then(({ data }) => {
      setCounterparties((data as Counterparty[]) ?? [])
    })
  }, [dealItem])

  // ── Поиск ───────────────────────────────────────────────

  async function search(value: string) {
    const val = value.trim()
    if (!val) return

    setLoading(true)
    setNotFound(false)
    setSerialResult(null)
    setUpcResults([])
    setDealItem(null)
    setDealDone(false)
    setDealError(null)

    const mode = detectMode(val)
    setSearchMode(mode)
    const supabase = createClient()

    if (mode === 'upc') {
      // ── UPC: ищем все листинги с этим кодом ──
      const { data } = await supabase
        .from('listings')
        .select(`
          id, title, brand, model, price, quantity, status, upc,
          seller:profiles!listings_seller_id_fkey(id, name, location),
          serial_items(id, serial_number, imei, status)
        `)
        .eq('upc', val)
        .neq('status', 'sold')
        .order('price')

      if (!data || data.length === 0) {
        setNotFound(true)
      } else {
        setUpcResults(data as UPCListing[])
      }

    } else {
      // ── S/N или IMEI: ищем конкретный серийник ──
      const q = val.toUpperCase()
      const { data } = await supabase
        .from('serial_items')
        .select(`
          *,
          listing:listings(id, title, brand, price, seller_id, upc),
          order:orders(
            id, total_price, created_at,
            buyer:profiles!orders_buyer_id_fkey(name, location)
          )
        `)
        .or(`serial_number.eq.${q},imei.eq.${q}`)
        .single()

      if (data) {
        const item = data as SerialItem
        setSerialResult(item)
        setDealPrice(String(item.listing?.price ?? ''))
      } else {
        setNotFound(true)
      }
    }

    setLoading(false)
  }

  function handleScan(r: ScanResult) {
    setShowScanner(false)
    setQuery(r.value)
    search(r.value)
  }

  // ── Проведение сделки ────────────────────────────────────

  function openDeal(item: SerialItem) {
    setDealItem(item)
    setDealPrice(String(item.listing?.price ?? ''))
    setDealDone(false)
    setDealError(null)
  }

  async function conductDeal() {
    if (!dealItem || !currentUserId || !dealPrice) return
    setDealing(true); setDealError(null)

    const supabase = createClient()
    const price = parseInt(dealPrice.replace(/\D/g, ''))

    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          listing_id: dealItem.listing?.id ?? null,
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
        .eq('id', dealItem.id)

      if (dealItem.listing?.id) {
        const { data: listing } = await supabase
          .from('listings').select('quantity').eq('id', dealItem.listing.id).single()
        const newQty = Math.max(0, (listing?.quantity ?? 1) - 1)
        await supabase.from('listings').update({
          quantity: newQty, status: newQty === 0 ? 'sold' : 'active',
        }).eq('id', dealItem.listing.id)
      }

      if (dealCounterparty) {
        await supabase.from('payments').insert({
          counterparty_id: dealCounterparty, owner_id: currentUserId,
          amount: price, direction: 'in', method: dealMethod,
          order_id: order.id, note: dealNote || null,
        })
      }

      setDealDone(true)
      setDealItem(null)

      // Обновляем результаты в UI
      if (serialResult) {
        setSerialResult(prev => prev ? {
          ...prev, status: 'sold',
          order: { id: order.id, total_price: price, created_at: new Date().toISOString(), buyer: null },
        } : null)
      }
      if (upcResults.length > 0) {
        setUpcResults(prev => prev.map(l => ({
          ...l,
          serial_items: l.serial_items.map(si =>
            si.id === dealItem.id ? { ...si, status: 'sold' } : si
          ),
        })))
      }

    } catch (e: unknown) {
      setDealError(e instanceof Error ? e.message : 'Ошибка проведения сделки')
    } finally {
      setDealing(false)
    }
  }

  // ─── Рендер ───────────────────────────────────────────────

  const priceNum = parseInt(dealPrice.replace(/\D/g, '') || '0')
  const listingPrice = dealItem?.listing?.price ?? 0
  const priceDiff = listingPrice > 0 ? Math.round(((priceNum - listingPrice) / listingPrice) * 100) : 0
  const st = serialResult ? STATUS_LABEL[serialResult.status] ?? STATUS_LABEL.available : null

  return (
    <div>
      {/* ── Строка поиска ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query)}
          placeholder="Серийный номер, IMEI или UPC..."
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

      {/* Подсказка режима */}
      {searchMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: searchMode === 'upc' ? '#FFF8E0' : '#EBF2FF',
            color: searchMode === 'upc' ? '#7A5E00' : '#1249A8',
          }}>
            {searchMode === 'upc' ? '📦 Поиск по UPC' : '🔍 Поиск по серийнику'}
          </span>
        </div>
      )}

      {/* ── Не найдено ── */}
      {notFound && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 32, marginBottom: 10 }}>🔍</p>
          <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Не найдено</p>
          <p style={{ fontSize: 14, color: '#9498AB' }}>
            {searchMode === 'upc'
              ? `Нет товаров с UPC «${query}» в Dexa`
              : `«${query}» не зарегистрирован в Dexa`}
          </p>
        </div>
      )}

      {/* ── Сделка проведена ── */}
      {dealDone && (
        <div style={{ background: '#E6F9F3', borderRadius: 16, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>✅</p>
          <p style={{ fontWeight: 700, fontSize: 17, color: '#006644', marginBottom: 4 }}>Сделка проведена</p>
          <p style={{ fontSize: 14, color: '#5A5E72' }}>
            {priceNum > 0 ? `${priceNum.toLocaleString('ru-RU')} ₽` : ''}
          </p>
        </div>
      )}

      {/* ══ UPC РЕЗУЛЬТАТЫ ══ */}
      {upcResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#9498AB', fontWeight: 600 }}>
            Найдено {upcResults.length} предложени{upcResults.length === 1 ? 'е' : 'й'} с этим UPC:
          </p>
          {upcResults.map(listing => {
            const availableItems = listing.serial_items.filter(si => si.status === 'available')
            return (
              <div key={listing.id} className="card" style={{ padding: '16px' }}>
                {/* Заголовок листинга */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21' }}>{listing.title}</p>
                    {listing.brand && <p style={{ fontSize: 13, color: '#9498AB', marginTop: 2 }}>{listing.brand}{listing.model ? ` ${listing.model}` : ''}</p>}
                    {listing.seller && (
                      <p style={{ fontSize: 12, color: '#5A5E72', marginTop: 4 }}>
                        📍 {listing.seller.name}{listing.seller.location ? ` · ${listing.seller.location}` : ''}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#1E6FEB', fontFamily: 'var(--font-mono)' }}>
                      {listing.price.toLocaleString('ru-RU')} ₽
                    </p>
                    <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>
                      {listing.quantity} шт в наличии
                    </p>
                  </div>
                </div>

                {/* Серийники этого листинга */}
                {listing.serial_items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Серийные номера
                    </p>
                    {listing.serial_items.map(si => {
                      const siSt = STATUS_LABEL[si.status] ?? STATUS_LABEL.available
                      const isAvail = si.status === 'available'
                      return (
                        <div key={si.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: '#F8F9FB', borderRadius: 10, padding: '10px 12px',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {si.serial_number && (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>
                                {si.serial_number}
                              </p>
                            )}
                            {si.imei && (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9498AB', marginTop: 2 }}>
                                IMEI: {si.imei}
                              </p>
                            )}
                            {!si.serial_number && !si.imei && (
                              <p style={{ fontSize: 13, color: '#9498AB' }}>Без серийника</p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ background: siSt.bg, color: siSt.color, borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                              {siSt.label}
                            </span>
                            {isAvail && currentUserId === listing.seller?.id && (
                              <button
                                onClick={() => openDeal({
                                  id: si.id,
                                  serial_number: si.serial_number,
                                  imei: si.imei,
                                  status: si.status,
                                  acquired_price: null,
                                  created_at: new Date().toISOString(),
                                  listing: {
                                    id: listing.id,
                                    title: listing.title,
                                    brand: listing.brand,
                                    price: listing.price,
                                    seller_id: listing.seller?.id ?? '',
                                    upc: listing.upc,
                                  },
                                  order: null,
                                })}
                                style={{
                                  padding: '5px 10px', borderRadius: 8, border: 'none',
                                  background: '#1E6FEB', color: 'white',
                                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                Продать
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {availableItems.length === 0 && (
                      <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '8px 0' }}>
                        Все единицы проданы
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#9498AB' }}>Серийники не добавлены · {listing.quantity} шт</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ S/N РЕЗУЛЬТАТ ══ */}
      {serialResult && st && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 4 }}>Устройство</p>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21' }}>
                  {serialResult.listing?.title ?? 'Неизвестный товар'}
                </p>
                {serialResult.listing?.brand && (
                  <p style={{ fontSize: 13, color: '#9498AB', marginTop: 2 }}>{serialResult.listing.brand}</p>
                )}
                {serialResult.listing?.price && (
                  <p style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1E6FEB', marginTop: 6 }}>
                    {serialResult.listing.price.toLocaleString('ru-RU')} ₽
                  </p>
                )}
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {st.label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {serialResult.serial_number && (
                <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 2 }}>Серийный номер</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>
                    {serialResult.serial_number}
                  </p>
                </div>
              )}
              {serialResult.imei && (
                <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 2 }}>IMEI</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>
                    {serialResult.imei}
                  </p>
                </div>
              )}
            </div>

            {serialResult.status === 'available' && !dealDone && !dealItem && (
              <button onClick={() => openDeal(serialResult)} style={{
                marginTop: 14, width: '100%', minHeight: 50,
                background: '#1E6FEB', color: 'white',
                border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                🤝 Провести сделку
              </button>
            )}
          </div>

          {/* История */}
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
                    {new Date(serialResult.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {serialResult.acquired_price && (
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#5A5E72' }}>
                        {' · '}закуп {serialResult.acquired_price.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {serialResult.order && (
                <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -20, width: 14, height: 14, borderRadius: '50%', background: '#E6F9F3', border: '2px solid #00B173', top: 2 }}/>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>Продажа</p>
                    <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>
                      {new Date(serialResult.order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {serialResult.order.buyer && (
                      <p style={{ fontSize: 12, color: '#5A5E72', marginTop: 4 }}>
                        Покупатель: <span style={{ fontWeight: 600, color: '#1A1C21' }}>{serialResult.order.buyer.name}</span>
                        {serialResult.order.buyer.location && ` · ${serialResult.order.buyer.location}`}
                      </p>
                    )}
                    <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00B173', marginTop: 4 }}>
                      {serialResult.order.total_price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ ФОРМА СДЕЛКИ (модальная снизу) ══ */}
      {dealItem && !dealDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setDealItem(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px',
              paddingBottom: 'calc(20px + var(--sab))',
              maxHeight: '90dvh', overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E1E6', margin: '0 auto 16px' }}/>

            <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>
              🤝 Провести сделку
            </p>
            <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 20 }}>
              {dealItem.listing?.title} · {dealItem.serial_number ?? dealItem.imei ?? '—'}
            </p>

            {/* Цена */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Цена продажи
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={dealPrice}
                  onChange={e => setDealPrice(e.target.value)}
                  type="number"
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, paddingRight: 48, color: '#1A1C21' }}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: '#9498AB' }}>₽</span>
              </div>
              {listingPrice > 0 && priceNum > 0 && (
                <p style={{ fontSize: 12, color: priceDiff >= 0 ? '#006644' : '#A8170F', marginTop: 5 }}>
                  {priceDiff >= 0 ? '↑' : '↓'} {Math.abs(priceDiff)}% к прайсу ({listingPrice.toLocaleString('ru-RU')} ₽)
                </p>
              )}
            </div>

            {/* Метод оплаты */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9498AB', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#00B173', fontFamily: 'var(--font-mono)' }}>
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
                width: '100%', minHeight: 54,
                background: (!dealPrice || priceNum === 0 || dealing) ? '#9498AB' : '#00B173',
                color: 'white', border: 'none', borderRadius: 14,
                fontSize: 16, fontWeight: 700, cursor: dealing ? 'not-allowed' : 'pointer',
              }}
            >
              {dealing ? 'Проводим...' : `✓ Провести${priceNum > 0 ? ` · ${priceNum.toLocaleString('ru-RU')} ₽` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Сканер */}
      {showScanner && (
        <BarcodeScanner
          mode="any"
          hint="Серийник, IMEI или UPC штрихкод"
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
