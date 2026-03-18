'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Order } from '@/types'
import ListingCard from '@/components/listings/ListingCard'
import FilterSheet, { FilterState, EMPTY_FILTER } from '@/components/ui/FilterSheet'

type DashboardProps = {
  listings: Listing[]
  activeOrders: Order[]
  unreadCount: number
  lowStockCount: number
  currentUserId: string
  totalOrdersValue: number
}

export default function HomeDashboard({
  listings: initialListings,
  activeOrders,
  unreadCount,
  lowStockCount,
  currentUserId,
  totalOrdersValue,
}: DashboardProps) {
  const router = useRouter()
  const [listings, setListings]     = useState<Listing[]>(initialListings)
  const [filter, setFilter]         = useState<FilterState>(EMPTY_FILTER)
  const [search, setSearch]         = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [showLocMenu, setShowLocMenu] = useState(false)
  const [tab, setTab]               = useState<'market' | 'new'>('market')

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('feed-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  const filtered = listings
    .filter(l => {
      if (l.status !== 'active') return false
      if (filter.brand && l.brand !== filter.brand) return false
      if (filter.condition !== 'all' && l.condition !== filter.condition) return false
      if (filter.minPrice && l.price < Number(filter.minPrice)) return false
      if (filter.maxPrice && l.price > Number(filter.maxPrice)) return false
      if (search) {
        const q = search.toLowerCase()
        return l.title.toLowerCase().includes(q) || (l.brand?.toLowerCase().includes(q) ?? false)
      }
      return true
    })
    .sort((a, b) => {
      if (filter.sort === 'price_asc')  return a.price - b.price
      if (filter.sort === 'price_desc') return b.price - a.price
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const activeFilterCount = [
    filter.brand !== '',
    filter.condition !== 'all',
    filter.minPrice !== '' || filter.maxPrice !== '',
    filter.sort !== 'newest',
  ].filter(Boolean).length

  function removeFilter(key: keyof FilterState) {
    setFilter(p => ({ ...p, [key]: EMPTY_FILTER[key] }))
  }

  const LOCATIONS = ['Горбушка', 'Митино', 'Савёловский', 'Царицыно']

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-unbounded)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#1A1C21' }}>
            <span style={{ color: '#F0B90B' }}>D</span>EXA
          </span>

          {/* Локация */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLocMenu(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#EBF2FF', borderRadius: 20, border: 'none',
              padding: '6px 12px', cursor: 'pointer',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1249A8' }}>{filter.location}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="3"
                style={{ transform: showLocMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {showLocMenu && (
              <div className="anim-fade" style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 60,
                background: '#fff', borderRadius: 14, border: '1px solid #E0E1E6',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 160,
              }}>
                {LOCATIONS.map((loc, i) => (
                  <button key={loc} onClick={() => { if (i === 0) setFilter(p => ({ ...p, location: loc })); setShowLocMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '11px 16px',
                      background: filter.location === loc ? '#EBF2FF' : 'transparent',
                      border: 'none', cursor: i === 0 ? 'pointer' : 'not-allowed',
                      borderBottom: i < LOCATIONS.length - 1 ? '1px solid #F0F1F4' : 'none',
                      fontSize: 14, fontWeight: 600,
                      color: filter.location === loc ? '#1249A8' : i > 0 ? '#CDD0D8' : '#1A1C21',
                    }}>
                    <span>{loc}</span>
                    {i > 0 && <span style={{ fontSize: 10, background: '#F2F3F5', color: '#9498AB', padding: '2px 6px', borderRadius: 5 }}>скоро</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Поиск + фильтр */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="iPhone, MacBook, Samsung..."
              className="input" style={{ paddingLeft: 40 }} />
          </div>
          <button onClick={() => setShowFilter(true)} style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: activeFilterCount > 0 ? '#1E6FEB' : '#fff',
            border: activeFilterCount > 0 ? 'none' : '1.5px solid #E0E1E6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={activeFilterCount > 0 ? '#fff' : '#5A5E72'} strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5,
                width: 18, height: 18, borderRadius: '50%',
                background: '#E8251F', color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #F2F3F5',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Активные фильтры chips */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {filter.brand && <span className="filter-chip" onClick={() => removeFilter('brand')}>{filter.brand} ×</span>}
            {filter.condition !== 'all' && <span className="filter-chip" onClick={() => removeFilter('condition')}>{filter.condition === 'new' ? 'Новый' : 'Б/У'} ×</span>}
            {(filter.minPrice || filter.maxPrice) && <span className="filter-chip" onClick={() => { removeFilter('minPrice'); removeFilter('maxPrice') }}>Цена ×</span>}
            {filter.sort !== 'newest' && <span className="filter-chip" onClick={() => removeFilter('sort')}>{filter.sort === 'price_asc' ? '↑ Цена' : '↓ Цена'} ×</span>}
          </div>
        )}
      </div>

      {/* ── Дашборд-блоки ── */}
      {activeOrders.length > 0 || unreadCount > 0 || lowStockCount > 0 ? (
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>

          {/* Активные сделки */}
          {activeOrders.length > 0 && (
            <Link href="/orders" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                background: '#1E6FEB', borderRadius: 16, padding: '12px 16px',
                minWidth: 140, cursor: 'pointer',
              }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Активных сделок</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#fff' }}>
                  {activeOrders.length}
                </p>
                {totalOrdersValue > 0 && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {Math.round(totalOrdersValue / 1000)}к ₽
                  </p>
                )}
              </div>
            </Link>
          )}

          {/* Непрочитанные */}
          {unreadCount > 0 && (
            <Link href="/chat" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                background: '#2AABEE', borderRadius: 16, padding: '12px 16px',
                minWidth: 130, cursor: 'pointer',
              }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Новых сообщений</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#fff' }}>{unreadCount}</p>
              </div>
            </Link>
          )}

          {/* Алерты склада */}
          {lowStockCount > 0 && (
            <Link href="/warehouse" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                background: '#FFF4E0', border: '1.5px solid #F5A623',
                borderRadius: 16, padding: '12px 16px',
                minWidth: 130, cursor: 'pointer',
              }}>
                <p style={{ fontSize: 11, color: '#7A4F00', marginBottom: 4 }}>🔔 Заканчивается</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#7A4F00' }}>{lowStockCount}</p>
                <p style={{ fontSize: 11, color: '#9A6800', marginTop: 2 }}>товаров</p>
              </div>
            </Link>
          )}
        </div>
      ) : null}

      {/* ── Лента товаров ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p className="section-label">
            {filtered.length > 0 ? `Предложения · ${filtered.length}` : 'Нет предложений'}
          </p>
          {filter.sort !== 'newest' && (
            <span style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {filter.sort === 'price_asc' ? '↑ по цене' : '↓ по цене'}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Ничего не найдено</p>
            <button onClick={() => { setFilter(EMPTY_FILTER); setSearch('') }} style={{
              background: '#EBF2FF', color: '#1249A8', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
          </div>
        )}
      </div>

      {/* FilterSheet */}
      {showFilter && (
        <FilterSheet value={filter} onApply={setFilter} onClose={() => setShowFilter(false)} />
      )}

      {showLocMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setShowLocMenu(false)} />
      )}
    </div>
  )
}
