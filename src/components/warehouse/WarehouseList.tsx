'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, ListingTemplate } from '@/types'
import ExportButton from '@/components/listings/ExportButton'
import dynamic from 'next/dynamic'
const QuickDealSheet = dynamic(() => import('@/components/warehouse/QuickDealSheet'), { ssr: false })

function calcMargin(price: number, cost: number | null) {
  if (!cost || cost <= 0) return null
  return Math.round(((price - cost) / price) * 100)
}

export default function WarehouseList({
  initialListings,
  initialTemplates,
}: {
  initialListings: Listing[]
  initialTemplates: ListingTemplate[]
}) {
  const router = useRouter()

  // Get current user ID for QuickDeal
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const [listings, setListings]   = useState<Listing[]>(initialListings)
  const [templates, setTemplates] = useState<ListingTemplate[]>(initialTemplates)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'reserved' | 'sold'>('all')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [batchAction, setBatchAction]   = useState<string | null>(null)
  const [quickDealListing, setQuickDealListing] = useState<Listing | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [batchPrice, setBatchPrice]     = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null) // id товара для подтверждения

  const filtered = useMemo(() => listings.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (onlyLowStock && !(l.min_stock > 0 && l.quantity <= l.min_stock)) return false
    if (search) {
      const q = search.toLowerCase()
      return l.title.toLowerCase().includes(q) || (l.brand?.toLowerCase().includes(q) ?? false)
    }
    return true
  }), [listings, statusFilter, onlyLowStock, search])

  const lowStockCount = useMemo(
    () => listings.filter(l => l.min_stock > 0 && l.quantity <= l.min_stock && l.status !== 'sold').length,
    [listings]
  )

  const totalValue  = listings.reduce((s, l) => s + l.price * l.quantity, 0)
  const totalCost   = listings.reduce((s, l) => s + (l.cost_price ?? 0) * l.quantity, 0)
  const totalMargin = totalCost > 0 ? Math.round(((totalValue - totalCost) / totalValue) * 100) : null

  function toggleSelect(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() {
    setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map(l => l.id)))
  }

  async function toggleStatus(l: Listing, e: React.MouseEvent) {
    e.stopPropagation()
    const next = l.status === 'active' ? 'sold' : 'active'
    const supabase = createClient()
    await supabase.from('listings').update({ status: next }).eq('id', l.id)
    setListings(p => p.map(x => x.id === l.id ? { ...x, status: next as Listing['status'] } : x))
  }

  function del(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleteConfirm(id)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    const supabase = createClient()
    await supabase.from('listings').delete().eq('id', deleteConfirm)
    setListings(p => p.filter(x => x.id !== deleteConfirm))
    setDeleteConfirm(null)
  }

  async function delTemplate(id: string) {
    const supabase = createClient()
    await supabase.from('listing_templates').delete().eq('id', id)
    setTemplates(p => p.filter(t => t.id !== id))
  }

  async function runBatch() {
    if (selected.size === 0 || !batchAction) return
    setBatchLoading(true)
    const supabase = createClient()
    const ids = [...selected]
    if (batchAction === 'publish') {
      await supabase.from('listings').update({ status: 'active' }).in('id', ids)
      setListings(p => p.map(l => selected.has(l.id) ? { ...l, status: 'active' as const } : l))
    } else if (batchAction === 'archive') {
      await supabase.from('listings').update({ status: 'sold' }).in('id', ids)
      setListings(p => p.map(l => selected.has(l.id) ? { ...l, status: 'sold' as const } : l))
    } else if (batchAction === 'price' && batchPrice) {
      await supabase.from('listings').update({ price: Number(batchPrice) }).in('id', ids)
      setListings(p => p.map(l => selected.has(l.id) ? { ...l, price: Number(batchPrice) } : l))
    } else if (batchAction === 'delete') {
      await supabase.from('listings').delete().in('id', ids)
      setListings(p => p.filter(l => !selected.has(l.id)))
    }
    setSelected(new Set()); setBatchAction(null); setBatchPrice(''); setBatchLoading(false)
    router.refresh()
  }

  const content = (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Мой склад</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Поиск по S/N */}
            <Link href="/warehouse/scan">
              <button style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#F2F3F5', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} title="Поиск по серийному номеру">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5E72" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                  <rect x="7" y="7" width="10" height="10" rx="1"/>
                </svg>
              </button>
            </Link>
            <Link href="/warehouse/new">
              <button style={{
                background: '#1E6FEB', color: '#fff', border: 'none',
                borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                + Добавить
              </button>
            </Link>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по складу..." className="input" style={{ paddingLeft: 40 }} />
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all','active','reserved','sold'] as const).map(v => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: statusFilter === v ? '#1E6FEB' : '#ECEDF0',
              color: statusFilter === v ? '#fff' : '#5A5E72',
            }}>
              {v === 'all' ? 'Все' : v === 'active' ? 'В ленте' : v === 'reserved' ? 'Бронь' : 'Архив'}
            </button>
          ))}
          {lowStockCount > 0 && (
            <button onClick={() => setOnlyLowStock(p => !p)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: onlyLowStock ? '#FFEBEA' : '#FFF4E0',
              color: onlyLowStock ? '#E8251F' : '#7A4F00',
            }}>
              🔔 Мало · {lowStockCount}
            </button>
          )}
        </div>
      </div>

      {/* Статы */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '12px 16px 0' }}>
        {[
          { label: 'В ленте',   val: listings.filter(l => l.status === 'active').length, color: '#1A1C21' },
          { label: 'На складе', val: `${Math.round(totalValue / 1000)}к ₽`, color: '#1A1C21' },
          { label: 'Маржа',     val: totalMargin !== null ? `${totalMargin}%` : '—',
            color: totalMargin !== null ? (totalMargin > 15 ? '#00B173' : '#F5A623') : '#9498AB' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 12px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</p>
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Алерт */}
      {lowStockCount > 0 && !onlyLowStock && (
        <div style={{ margin: '10px 16px 0' }}>
          <button onClick={() => setOnlyLowStock(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: '#FFF4E0', border: '1.5px solid #F5A623', borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#7A4F00' }}>
              {lowStockCount} товар{lowStockCount > 1 ? 'а' : ''} заканчивается
            </p>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      )}

      {/* Шаблоны */}
      {templates.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <p className="section-label" style={{ marginBottom: 8 }}>Шаблоны</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {templates.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <Link href={`/warehouse/new?template=${t.id}`}>
                  <button style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: '10px 0 0 10px', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRight: '1px solid #C5D9F5' }}>
                    📋 {t.name}
                  </button>
                </Link>
                <button onClick={() => delTemplate(t.id)} style={{ background: '#EBF2FF', color: '#9498AB', border: 'none', borderRadius: '0 10px 10px 0', padding: '6px 8px', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Массовые операции */}
      {selected.size > 0 && (
        <div style={{ margin: '10px 16px 0', background: '#1A1C21', borderRadius: 14, padding: '12px 14px', animation: 'fade-up 0.18s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Выбрано: {selected.size}</p>
            <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#9498AB', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Снять</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'publish', label: '↑ В ленту', bg: '#E6F9F3', color: '#006644' },
              { id: 'archive', label: '↓ Архив',   bg: '#F2F3F5', color: '#5A5E72' },
              { id: 'price',   label: '₽ Цена',    bg: '#FFF4E0', color: '#7A4F00' },
              { id: 'delete',  label: '🗑 Удалить', bg: '#FFEBEA', color: '#E8251F' },
            ].map(a => (
              <button key={a.id} onClick={() => setBatchAction(batchAction === a.id ? null : a.id)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: batchAction === a.id ? '#fff' : a.bg, color: batchAction === a.id ? '#1A1C21' : a.color, fontSize: 12, fontWeight: 600 }}>
                {a.label}
              </button>
            ))}
          </div>
          {batchAction === 'price' && (
            <input type="number" value={batchPrice} onChange={e => setBatchPrice(e.target.value)}
              placeholder="Новая цена ₽" className="input"
              style={{ marginTop: 10, fontSize: 14, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
          )}
          {batchAction && (
            <button onClick={runBatch} disabled={batchLoading || (batchAction === 'price' && !batchPrice)} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, background: batchAction === 'delete' ? '#E8251F' : '#1E6FEB', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: batchLoading ? 0.6 : 1 }}>
              {batchLoading ? 'Применяем...' : `Применить к ${selected.size} товарам`}
            </button>
          )}
        </div>
      )}

      {/* Список */}
      <div style={{ padding: '12px 16px 0' }}>
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="section-label">{filtered.length} позиций</p>
            <button onClick={selectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1E6FEB', fontWeight: 600 }}>
              {selected.size === filtered.length ? 'Снять всё' : 'Выбрать всё'}
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 8 }}>{listings.length === 0 ? 'Склад пуст' : 'Нет совпадений'}</p>
            <Link href="/warehouse/new">
              <button style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Добавить первый товар
              </button>
            </Link>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(l => {
              const margin     = calcMargin(l.price, l.cost_price)
              const isLow      = l.min_stock > 0 && l.quantity <= l.min_stock
              const isSelected = selected.has(l.id)

              return (
                <div key={l.id} className="card anim-card" style={{ padding: '12px 14px', border: isSelected ? '2px solid #1E6FEB' : isLow ? '1.5px solid #F5A623' : '1px solid #E0E1E6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <button onClick={() => toggleSelect(l.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2, border: isSelected ? 'none' : '1.5px solid #CDD0D8', background: isSelected ? '#1E6FEB' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {l.title}
                        </p>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {l.status === 'active' && (
                            <button onClick={e => { e.stopPropagation(); setQuickDealListing(l) }} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E0E1E6', background: '#EBF2FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Провести сделку">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                            </button>
                          )}
                          <Link href={`/warehouse/${l.id}/edit`}>
                            <button title="Редактировать" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E0E1E6', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A5E72" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </Link>
                          <button onClick={e => toggleStatus(l, e)} title="Убрать/вернуть в ленту" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E0E1E6', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#5A5E72', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {l.status === 'active' ? '↓' : '↑'}
                          </button>
                          <button onClick={e => del(l.id, e)} title="Удалить" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FFCDD0', background: '#FFEBEA', cursor: 'pointer', fontSize: 16, color: '#E8251F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>{l.price.toLocaleString('ru-RU')} ₽</span>
                        {l.cost_price && <span style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>себест. {l.cost_price.toLocaleString('ru-RU')} ₽</span>}
                        {margin !== null && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: margin > 15 ? '#006644' : '#7A4F00', background: margin > 15 ? '#E6F9F3' : '#FFF4E0', padding: '1px 6px', borderRadius: 5 }}>+{margin}%</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: isLow ? '#E8251F' : '#5A5E72' }}>
                          {isLow && '🔔 '}{l.quantity} шт{l.min_stock > 0 && <span style={{ color: '#9498AB', fontWeight: 400 }}> / мин {l.min_stock}</span>}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: l.status === 'active' ? '#006644' : l.status === 'reserved' ? '#7A4F00' : '#9498AB' }}>
                          {l.status === 'active' ? '● В ленте' : l.status === 'reserved' ? '◐ Бронь' : '○ Архив'}
                        </span>
                        {Array.isArray(l.tags) && l.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, background: '#F2F3F5', color: '#5A5E72', borderRadius: 5, padding: '2px 6px' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ padding: '12px 0 4px' }}>
          <ExportButton />
        </div>
      </div>
      {/* QuickDeal Sheet */}
      {quickDealListing && currentUserId && (
        <QuickDealSheet
          listing={quickDealListing}
          userId={currentUserId}
          onClose={() => setQuickDealListing(null)}
        />
      )}
    </div>
  )

  return (
    <>
      {content}

      {/* Диалог подтверждения удаления */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430, background: '#fff',
            borderRadius: '20px 20px 16px 16px', padding: '20px 16px',
            animation: 'fade-up 0.2s ease both',
          }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 6, textAlign: 'center' }}>
              Удалить товар?
            </p>
            <p style={{ fontSize: 14, color: '#9498AB', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              {listings.find(l => l.id === deleteConfirm)?.title ?? 'Товар'} будет удалён без возможности восстановления
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: '13px', borderRadius: 12, border: '1.5px solid #E0E1E6',
                background: '#fff', fontSize: 15, fontWeight: 600, color: '#5A5E72', cursor: 'pointer',
              }}>Отмена</button>
              <button onClick={confirmDelete} style={{
                padding: '13px', borderRadius: 12, border: 'none',
                background: '#E8251F', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
