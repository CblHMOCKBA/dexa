'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'

type SerialItem = {
  id: string
  serial_number: string | null
  imei: string | null
  status: string
  acquired_price: number | null
  created_at: string
  listing: { title: string; brand: string | null } | null
  order: {
    id: string
    total_price: number
    created_at: string
    buyer: { name: string; location: string | null } | null
  } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'В наличии',    color: '#006644', bg: '#E6F9F3' },
  reserved:  { label: 'Забронирован', color: '#7A4F00', bg: '#FFF4E0' },
  sold:      { label: 'Продан',        color: '#9498AB', bg: '#F2F3F5' },
  repair:    { label: 'В ремонте',     color: '#5B00CC', bg: '#F0E8FF' },
  returned:  { label: 'Возврат',       color: '#A8170F', bg: '#FFEBEA' },
}

export default function SerialSearch() {
  const [query, setQuery]       = useState('')
  const [result, setResult]     = useState<SerialItem | null>(null)
  const [loading, setLoading]   = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function search(value: string) {
    if (!value.trim()) return
    setLoading(true); setNotFound(false); setResult(null)

    const supabase = createClient()
    const q = value.trim().toUpperCase()

    // Ищем по серийному номеру ИЛИ IMEI
    const { data } = await supabase
      .from('serial_items')
      .select(`
        *,
        listing:listings(title, brand),
        order:orders(
          id, total_price, created_at,
          buyer:profiles!orders_buyer_id_fkey(name, location)
        )
      `)
      .or(`serial_number.eq.${q},imei.eq.${q}`)
      .single()

    setResult(data ? data as SerialItem : null)
    setNotFound(!data)
    setLoading(false)
  }

  function handleScan(r: ScanResult) {
    setShowScanner(false)
    setQuery(r.value)
    search(r.value)
  }

  const st = result ? STATUS_LABEL[result.status] ?? STATUS_LABEL.available : null

  return (
    <div>
      {/* Поиск */}
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
        {/* Сканер — mode=any читает и S/N и штрихкод */}
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
          <p style={{ fontSize: 14, color: '#9498AB' }}>
            «{query}» не зарегистрирован в Dexa
          </p>
        </div>
      )}

      {/* Результат */}
      {result && st && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 4 }}>Устройство</p>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.3 }}>
                  {result.listing?.title ?? 'Неизвестный товар'}
                </p>
                {result.listing?.brand && (
                  <p style={{ fontSize: 13, color: '#9498AB', marginTop: 2 }}>{result.listing.brand}</p>
                )}
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>
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
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
              История устройства
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 24 }}>
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

      {/* Сканер — mode=any: читает S/N и штрихкод */}
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
