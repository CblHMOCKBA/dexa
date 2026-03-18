'use client'

import { useState, useMemo } from 'react'

type OrderRow = {
  id: string
  total_price: number
  status: string
  created_at: string
  buyer_id: string
  seller_id: string
  quantity: number
  listing: { title: string; brand: string | null; model: string | null; cost_price: number | null } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

type ListingRow = {
  id: string
  title: string
  brand: string | null
  price: number
  quantity: number
  status: string
  cost_price: number | null
  created_at: string
}

type Period = '7d' | '30d' | '90d' | 'all'

const PERIOD_LABEL: Record<Period, string> = {
  '7d': '7 дней', '30d': '30 дней', '90d': '3 месяца', 'all': 'Всё время',
}

function periodStart(p: Period): Date | null {
  if (p === 'all') return null
  const d = new Date()
  if (p === '7d') d.setDate(d.getDate() - 7)
  else if (p === '30d') d.setDate(d.getDate() - 30)
  else d.setDate(d.getDate() - 90)
  return d
}

function fmt(n: number) { return n.toLocaleString('ru-RU') }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function AnalyticsDashboard({
  orders, listings, userId,
}: {
  orders: OrderRow[]
  listings: ListingRow[]
  userId: string
}) {
  const [period, setPeriod] = useState<Period>('30d')
  const [exporting, setExporting] = useState(false)

  const filtered = useMemo(() => {
    const start = periodStart(period)
    const completed = orders.filter(o => o.status === 'completed')
    if (!start) return completed
    return completed.filter(o => new Date(o.created_at) >= start)
  }, [orders, period])

  const sales = filtered.filter(o => o.seller_id === userId)
  const purchases = filtered.filter(o => o.buyer_id === userId)

  const revenue = sales.reduce((s, o) => s + o.total_price, 0)
  const spent = purchases.reduce((s, o) => s + o.total_price, 0)
  const dealsCount = filtered.length

  const margin = useMemo(() => {
    let totalRev = 0, totalCost = 0
    sales.forEach(o => {
      totalRev += o.total_price
      if (o.listing?.cost_price) totalCost += o.listing.cost_price * (o.quantity ?? 1)
    })
    if (totalCost === 0) return null
    return Math.round(((totalRev - totalCost) / totalRev) * 100)
  }, [sales])

  const avgDeal = dealsCount > 0 ? Math.round((revenue + spent) / dealsCount) : 0

  // Топ товаров по продажам
  const topProducts = useMemo(() => {
    const map = new Map<string, { title: string; brand: string | null; count: number; revenue: number }>()
    sales.forEach(o => {
      const key = o.listing?.title ?? 'Неизвестно'
      const cur = map.get(key) ?? { title: key, brand: o.listing?.brand ?? null, count: 0, revenue: 0 }
      cur.count += o.quantity ?? 1
      cur.revenue += o.total_price
      map.set(key, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [sales])

  const maxRev = topProducts[0]?.revenue ?? 1

  // Динамика по дням (последние 30 дней)
  const dailyData = useMemo(() => {
    const days = 30
    const map: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      map[d.toISOString().slice(0, 10)] = 0
    }
    sales.forEach(o => {
      const day = o.created_at.slice(0, 10)
      if (day in map) map[day] += o.total_price
    })
    return Object.entries(map).map(([date, amount]) => ({ date, amount }))
  }, [sales])

  const maxDay = Math.max(...dailyData.map(d => d.amount), 1)

  // Склад — остатки
  const warehouseAlerts = listings.filter(l => l.status === 'active' && l.quantity <= 2)
  const totalStockValue = listings.filter(l => l.status === 'active')
    .reduce((s, l) => s + l.price * l.quantity, 0)

  // Excel экспорт
  async function exportExcel() {
    setExporting(true)
    try {
      // Формируем расширенный CSV с тремя секциями
      const bom = '\uFEFF'

      // Лист 1: Сделки
      const headers1 = ['Дата', 'Тип', 'Товар', 'Бренд', 'Кол-во', 'Выручка', 'Себестоимость', 'Маржа', 'Контрагент']
      const rows1 = orders.filter(o => o.status === 'completed').map(o => {
        const isSeller = o.seller_id === userId
        const partner = isSeller ? o.buyer?.name : o.seller?.name
        const cost = o.listing?.cost_price ? o.listing.cost_price * (o.quantity ?? 1) : 0
        const marginVal = cost > 0 ? Math.round(((o.total_price - cost) / o.total_price) * 100) : ''
        return [
          fmtDate(o.created_at),
          isSeller ? 'Продажа' : 'Покупка',
          o.listing?.title ?? '',
          o.listing?.brand ?? '',
          o.quantity ?? 1,
          o.total_price,
          cost || '',
          marginVal !== '' ? `${marginVal}%` : '',
          partner ?? '',
        ]
      })

      // Лист 2: Топ товаров
      const headers2 = ['Товар', 'Бренд', 'Продано (шт)', 'Выручка (руб)']
      const rows2 = topProducts.map(p => [p.title, p.brand ?? '', p.count, p.revenue])

      // Лист 3: Склад
      const headers3 = ['Товар', 'Цена', 'Кол-во', 'Статус', 'Стоимость склада']
      const rows3 = listings.map(l => [
        l.title, l.price, l.quantity,
        l.status === 'active' ? 'В наличии' : l.status === 'sold' ? 'Продан' : 'Зарезервирован',
        l.price * l.quantity,
      ])

      function escCSV(v: unknown) {
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }
      function toCSV(headers: string[], rows: unknown[][]) {
        return [headers.map(escCSV).join(','), ...rows.map(r => r.map(escCSV).join(','))].join('\n')
      }

      const csv = [
        '=== СДЕЛКИ ===',
        toCSV(headers1, rows1),
        '',
        '=== ТОП ТОВАРОВ ===',
        toCSV(headers2, rows2),
        '',
        '=== СКЛАД ===',
        toCSV(headers3, rows3),
      ].join('\n')

      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dexa-analytics-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ padding: '16px 16px 24px' }}>

      {/* Переключатель периода */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: period === p ? '#1E6FEB' : '#F2F3F5',
            color: period === p ? 'white' : '#5A5E72',
            fontSize: 13, fontWeight: 600,
          }}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
        <button onClick={exportExcel} disabled={exporting} style={{
          padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: '#F0B90B', color: '#1A1C21', fontSize: 13, fontWeight: 700,
          marginLeft: 'auto',
        }}>
          {exporting ? '...' : '📥 Excel'}
        </button>
      </div>

      {/* KPI карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <KPICard label="Выручка" value={`${fmt(revenue)} ₽`} sub={`${sales.length} продаж`} color="#1E6FEB" icon="💰" />
        <KPICard label="Сделок всего" value={String(dealsCount)} sub={`ср. ${fmt(avgDeal)} ₽`} color="#00B173" icon="🤝" />
        <KPICard label="Маржа" value={margin !== null ? `${margin}%` : '—'} sub="по закрытым сделкам" color={margin && margin > 20 ? '#00B173' : '#F0B90B'} icon="📊" />
        <KPICard label="Склад" value={`${fmt(totalStockValue)} ₽`} sub={`${listings.filter(l => l.status === 'active').length} позиций`} color="#5B00CC" icon="📦" />
      </div>

      {/* График выручки по дням */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 14 }}>Выручка — 30 дней</p>
        {revenue === 0 ? (
          <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '20px 0' }}>Нет данных за период</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflowX: 'auto' }}>
            {dailyData.map(d => {
              const h = maxDay > 0 ? Math.max(4, Math.round((d.amount / maxDay) * 72)) : 4
              return (
                <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 18 }}>
                  <div
                    title={`${fmtDate(d.date)}: ${fmt(d.amount)} ₽`}
                    style={{
                      width: '100%', height: h, borderRadius: 3,
                      background: d.amount > 0 ? '#1E6FEB' : '#E0E1E6',
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Топ товаров */}
      {topProducts.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 14 }}>Топ товаров по выручке</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topProducts.map((p, i) => (
              <div key={p.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', marginRight: 6 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}
                      className="truncate">{p.title}</span>
                    {p.brand && <span style={{ fontSize: 11, color: '#9498AB', marginLeft: 6 }}>{p.brand}</span>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1E6FEB', fontFamily: 'var(--font-mono)' }}>
                      {fmt(p.revenue)} ₽
                    </p>
                    <p style={{ fontSize: 11, color: '#9498AB' }}>{p.count} шт</p>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#F2F3F5', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: '#1E6FEB',
                    width: `${Math.round((p.revenue / maxRev) * 100)}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Алерты склада */}
      {warehouseAlerts.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: 16, borderLeft: '3px solid #F0B90B' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7A4F00', marginBottom: 10 }}>
            ⚠️ Заканчивается на складе
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warehouseAlerts.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, color: '#1A1C21', flex: 1, minWidth: 0 }}>{l.title}</p>
                <span style={{ fontSize: 13, fontWeight: 700, color: l.quantity === 0 ? '#A8170F' : '#F0B90B', marginLeft: 12 }}>
                  {l.quantity === 0 ? 'Нет' : `${l.quantity} шт`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние сделки */}
      {filtered.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 14 }}>
            Последние сделки
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.slice(0, 10).map((o, i) => {
              const isSeller = o.seller_id === userId
              const partner = isSeller ? o.buyer?.name : o.seller?.name
              return (
                <div key={o.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < Math.min(filtered.length, 10) - 1 ? '1px solid #F2F3F5' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', marginBottom: 2 }}>
                      {o.listing?.title ?? 'Товар'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9498AB' }}>
                      {fmtDate(o.created_at)}
                      {partner && ` · ${isSeller ? '→' : '←'} ${partner}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      color: isSeller ? '#00B173' : '#A8170F',
                    }}>
                      {isSeller ? '+' : '−'}{fmt(o.total_price)} ₽
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>📊</p>
          <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Нет данных</p>
          <p style={{ fontSize: 14, color: '#9498AB' }}>Закрытые сделки появятся здесь</p>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: string
}) {
  return (
    <div className="card" style={{ padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <p style={{ fontSize: 11, color: '#9498AB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>{sub}</p>
    </div>
  )
}
