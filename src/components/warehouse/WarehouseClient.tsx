'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import PullIndicator from '@/components/ui/PullIndicator'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, ListingTemplate } from '@/types'
import LockedFeature from '@/components/ui/LockedFeature'

type FormData = {
  title: string
  brand: string
  model: string
  condition: 'new' | 'used'
  price: string
  quantity: string
  cost_price: string
  min_stock: string
  description: string
  tags: string
}

const EMPTY_FORM: FormData = {
  title: '', brand: '', model: '', condition: 'new',
  price: '', quantity: '1', cost_price: '', min_stock: '0',
  description: '', tags: '',
}

// FIX: явный маппинг — каждое поле обрабатывается по своему типу
function formFromTemplate(data: Partial<Listing>): FormData {
  return {
    title:       data.title ?? '',
    brand:       data.brand ?? '',
    model:       data.model ?? '',
    condition:   data.condition === 'used' ? 'used' : 'new',
    price:       data.price ? String(data.price) : '',
    quantity:    data.quantity ? String(data.quantity) : '1',
    cost_price:  data.cost_price ? String(data.cost_price) : '',
    min_stock:   data.min_stock ? String(data.min_stock) : '0',
    description: data.description ?? '',
    tags:        Array.isArray(data.tags) ? data.tags.join(', ') : '',
  }
}

function formFromListing(l: Listing): FormData {
  return {
    title:       l.title,
    brand:       l.brand ?? '',
    model:       l.model ?? '',
    condition:   l.condition === 'used' ? 'used' : 'new',
    price:       String(l.price),
    quantity:    String(l.quantity),
    cost_price:  l.cost_price ? String(l.cost_price) : '',
    min_stock:   String(l.min_stock ?? 0),
    description: l.description ?? '',
    tags:        Array.isArray(l.tags) ? l.tags.join(', ') : '',
  }
}

function calcMargin(price: number, cost: number | null) {
  if (!cost || cost <= 0) return null
  return Math.round(((price - cost) / price) * 100)
}

export default function WarehouseClient({
  initialListings,
  initialTemplates,
}: {
  initialListings: Listing[]
  initialTemplates: ListingTemplate[]
}) {
  const { containerRef, pullDistance, isRefreshing, triggered } = usePullToRefresh()
  const router = useRouter()

  const [listings, setListings]   = useState<Listing[]>(initialListings)
  const [templates, setTemplates] = useState<ListingTemplate[]>(initialTemplates)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'reserved' | 'sold'>('all')
  const [onlyLowStock, setOnlyLowStock] = useState(false)

  const [showForm, setShowForm]         = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const [batchAction, setBatchAction] = useState<string | null>(null)
  const [batchPrice, setBatchPrice]   = useState('')
  const [batchLoading, setBatchLoading] = useState(false)

  function f<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const filtered = useMemo(() => listings.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (onlyLowStock && !(l.min_stock > 0 && l.quantity <= l.min_stock)) return false
    if (search) {
      const q = search.toLowerCase()
      return l.title.toLowerCase().includes(q) ||
             (l.brand?.toLowerCase().includes(q) ?? false) ||
             (l.model?.toLowerCase().includes(q) ?? false)
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

  function openNew(tpl?: ListingTemplate) {
    setEditId(null)
    setForm(tpl ? formFromTemplate(tpl.data) : EMPTY_FORM)
    setFormError(null)
    setShowSaveTemplate(false)
    setTemplateName('')
    setShowForm(true)
  }

  function openEdit(l: Listing) {
    setEditId(l.id)
    setForm(formFromListing(l))
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowSaveTemplate(false)
    setTemplateName('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.price) { setFormError('Заполни название и цену'); return }
    setSaving(true); setFormError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      title:       form.title.trim(),
      brand:       form.brand.trim() || null,
      model:       form.model.trim() || null,
      condition:   form.condition,
      price:       Number(form.price),
      quantity:    Number(form.quantity) || 1,
      cost_price:  form.cost_price ? Number(form.cost_price) : null,
      min_stock:   Number(form.min_stock) || 0,
      description: form.description.trim() || null,
      tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }

    if (editId) {
      const { data, error } = await supabase
        .from('listings').update(payload).eq('id', editId).select('*').single()
      if (error) { setFormError('Ошибка сохранения'); setSaving(false); return }
      setListings(p => p.map(l => l.id === editId ? { ...l, ...data } : l))
    } else {
      const { data, error } = await supabase
        .from('listings').insert({ ...payload, seller_id: user.id }).select('*').single()
      if (error) { setFormError('Ошибка сохранения'); setSaving(false); return }
      setListings(p => [data, ...p])
    }

    if (showSaveTemplate && templateName.trim()) {
      const supabase2 = createClient()
      await supabase2.from('listing_templates').insert({
        seller_id: user.id,
        name: templateName.trim(),
        data: payload,
      })
    }

    setSaving(false)
    closeForm()
    router.refresh()
  }

  async function del(id: string) {
    const supabase = createClient()
    await supabase.from('listings').delete().eq('id', id)
    setListings(p => p.filter(x => x.id !== id))
  }

  async function toggleStatus(l: Listing) {
    const next = l.status === 'active' ? 'sold' : 'active'
    const supabase = createClient()
    await supabase.from('listings').update({ status: next }).eq('id', l.id)
    setListings(p => p.map(x => x.id === l.id ? { ...x, status: next as Listing['status'] } : x))
  }

  function toggleSelect(id: string) {
    setSelected(p => {
      const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  function selectAll() {
    setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map(l => l.id)))
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

    setSelected(new Set())
    setBatchAction(null)
    setBatchPrice('')
    setBatchLoading(false)
    router.refresh()
  }

  async function delTemplate(id: string) {
    const supabase = createClient()
    await supabase.from('listing_templates').delete().eq('id', id)
    setTemplates(p => p.filter(t => t.id !== id))
  }

  return (
    <div ref={containerRef} className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} triggered={triggered} />
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Мой склад</h1>
          <button onClick={() => openNew()} style={{
            background: '#1E6FEB', color: '#fff', border: 'none',
            borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            + Добавить
          </button>
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
          { label: 'В ленте',  val: listings.filter(l => l.status === 'active').length },
          { label: 'На складе', val: `${Math.round(totalValue / 1000)}к ₽` },
          { label: 'Маржа',    val: totalMargin !== null ? `${totalMargin}%` : '—',
            color: totalMargin !== null ? (totalMargin > 15 ? '#00B173' : '#F5A623') : '#9498AB' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 12px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: (s as { color?: string }).color ?? '#1A1C21' }}>
              {s.val}
            </p>
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Алерт остатков */}
      {lowStockCount > 0 && !onlyLowStock && (
        <div style={{ margin: '10px 16px 0' }}>
          <button onClick={() => setOnlyLowStock(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: '#FFF4E0', border: '1.5px solid #F5A623',
            borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#7A4F00' }}>
                {lowStockCount} товар{lowStockCount > 1 ? 'а' : ''} заканчивается
              </p>
              <p style={{ fontSize: 11, color: '#9A6800' }}>Нажми чтобы посмотреть</p>
            </div>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      )}

      {/* Шаблоны */}
      {templates.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
            Шаблоны
          </p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {templates.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => openNew(t)} style={{
                  background: '#EBF2FF', color: '#1249A8', border: 'none',
                  borderRadius: '10px 0 0 10px', padding: '6px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRight: '1px solid #C5D9F5',
                }}>
                  📋 {t.name}
                </button>
                <button onClick={() => delTemplate(t.id)} style={{
                  background: '#EBF2FF', color: '#9498AB', border: 'none',
                  borderRadius: '0 10px 10px 0', padding: '6px 8px', cursor: 'pointer', fontSize: 14,
                }}>
                  ×
                </button>
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
            <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#9498AB', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
              Снять
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'publish', label: '↑ В ленту', bg: '#E6F9F3', color: '#006644' },
              { id: 'archive', label: '↓ Архив',   bg: '#F2F3F5', color: '#5A5E72' },
              { id: 'price',   label: '₽ Цена',    bg: '#FFF4E0', color: '#7A4F00' },
              { id: 'delete',  label: '🗑 Удалить', bg: '#FFEBEA', color: '#E8251F' },
            ].map(a => (
              <button key={a.id} onClick={() => setBatchAction(batchAction === a.id ? null : a.id)} style={{
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: batchAction === a.id ? '#fff' : a.bg,
                color: batchAction === a.id ? '#1A1C21' : a.color,
                fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
              }}>
                {a.label}
              </button>
            ))}
          </div>
          {batchAction === 'price' && (
            <input type="number" value={batchPrice} onChange={e => setBatchPrice(e.target.value)}
              placeholder="Новая цена ₽" className="input" style={{ marginTop: 10, fontSize: 14, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
          )}
          {batchAction && (
            <button onClick={runBatch} disabled={batchLoading || (batchAction === 'price' && !batchPrice)} style={{
              width: '100%', marginTop: 10, padding: '10px', borderRadius: 10,
              background: batchAction === 'delete' ? '#E8251F' : '#1E6FEB',
              color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: batchLoading ? 0.6 : 1,
            }}>
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
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 8 }}>
              {listings.length === 0 ? 'Склад пуст' : 'Нет совпадений'}
            </p>
            <button onClick={() => openNew()} style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Добавить первый товар
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(l => {
              const margin     = calcMargin(l.price, l.cost_price)
              const isLow      = l.min_stock > 0 && l.quantity <= l.min_stock
              const isSelected = selected.has(l.id)

              return (
                <div key={l.id} className="card" style={{
                  padding: '12px 14px',
                  border: isSelected ? '2px solid #1E6FEB' : isLow ? '1.5px solid #F5A623' : '1px solid #E0E1E6',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Чекбокс */}
                    <button onClick={() => toggleSelect(l.id)} style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      border: isSelected ? 'none' : '1.5px solid #CDD0D8',
                      background: isSelected ? '#1E6FEB' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>

                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2"/>
                        <circle cx="12" cy="17" r="1"/>
                      </svg>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {l.title}
                        </p>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => openEdit(l)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E0E1E6', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A5E72" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => toggleStatus(l)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E0E1E6', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#5A5E72', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {l.status === 'active' ? '↓' : '↑'}
                          </button>
                          <button onClick={() => del(l.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FFCDD0', background: '#FFEBEA', cursor: 'pointer', fontSize: 16, color: '#E8251F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>
                          {l.price.toLocaleString('ru-RU')} ₽
                        </span>
                        {l.cost_price && <span style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>себест. {l.cost_price.toLocaleString('ru-RU')} ₽</span>}
                        {margin !== null && (
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: margin > 15 ? '#006644' : '#7A4F00', background: margin > 15 ? '#E6F9F3' : '#FFF4E0', padding: '1px 6px', borderRadius: 5 }}>
                            +{margin}%
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isLow && <span style={{ fontSize: 12 }}>🔔</span>}
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: isLow ? '#E8251F' : '#5A5E72' }}>
                            {l.quantity} шт{l.min_stock > 0 && <span style={{ color: '#9498AB', fontWeight: 400 }}> / мин {l.min_stock}</span>}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: l.status === 'active' ? '#006644' : l.status === 'reserved' ? '#7A4F00' : '#9498AB' }}>
                          {l.status === 'active' ? '● В ленте' : l.status === 'reserved' ? '◐ Бронь' : '○ Архив'}
                        </span>
                        {Array.isArray(l.tags) && l.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, background: '#F2F3F5', color: '#5A5E72', borderRadius: 5, padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Excel заглушка */}
      <div style={{ padding: '12px 16px' }}>
        <LockedFeature label="Выгрузка Excel" version="v1.0">
          <button style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed #CDD0D8', background: 'transparent', color: '#5A5E72', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            📊 Выгрузить историю сделок .xlsx
          </button>
        </LockedFeature>
      </div>

      {/* Bottom Sheet форма */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="anim-sheet" style={{ background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '94dvh', overflowY: 'auto', paddingBottom: 'calc(24px + var(--sab))' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E1E6' }}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 14px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>{editId ? 'Редактировать' : 'Новый товар'}</h2>
              <button onClick={closeForm} style={{ width: 30, height: 30, borderRadius: '50%', background: '#F2F3F5', border: 'none', cursor: 'pointer', fontSize: 18, color: '#5A5E72', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={save} style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Название *</label>
                <input value={form.title} onChange={e => f('title', e.target.value)} placeholder="iPhone 15 Pro Max 256GB" required className="input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Бренд</label>
                  <input value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Apple" className="input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Модель</label>
                  <input value={form.model} onChange={e => f('model', e.target.value)} placeholder="iPhone 15 Pro" className="input" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Состояние *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['new','used'] as const).map(c => (
                    <button key={c} type="button" onClick={() => f('condition', c)} style={{ padding: '11px', borderRadius: 12, fontSize: 15, fontWeight: 600, border: form.condition === c ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6', background: form.condition === c ? '#EBF2FF' : '#fff', color: form.condition === c ? '#1249A8' : '#5A5E72', cursor: 'pointer', transition: 'all 0.12s' }}>
                      {c === 'new' ? '✨ Новый' : '🔄 Б/У'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Цена продажи ₽ *</label>
                  <input type="number" value={form.price} onChange={e => f('price', e.target.value)} placeholder="119900" required min={1} className="input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Кол-во *</label>
                  <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)} placeholder="1" required min={0} className="input" />
                </div>
              </div>
              <div style={{ background: '#F8F9FF', borderRadius: 12, padding: '12px', border: '1px solid #E0E8FF' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>🔒 Только для вас</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#5A5E72', fontWeight: 600, marginBottom: 5 }}>Себестоимость ₽</label>
                    <input type="number" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} placeholder="80000" min={0} className="input" style={{ background: '#fff' }} />
                    {form.price && form.cost_price && Number(form.price) > 0 && Number(form.cost_price) > 0 && (
                      <p style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, color: calcMargin(Number(form.price), Number(form.cost_price))! > 15 ? '#006644' : '#7A4F00' }}>
                        Маржа: +{calcMargin(Number(form.price), Number(form.cost_price))}%
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#5A5E72', fontWeight: 600, marginBottom: 5 }}>Мин. остаток 🔔</label>
                    <input type="number" value={form.min_stock} onChange={e => f('min_stock', e.target.value)} placeholder="2" min={0} className="input" style={{ background: '#fff' }} />
                    <p style={{ fontSize: 10, color: '#9498AB', marginTop: 4 }}>Алерт при достижении</p>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Теги</label>
                <input value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="опт, срочно, новинка" className="input" />
                <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>Через запятую</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Описание</label>
                <textarea value={form.description} onChange={e => f('description', e.target.value)} placeholder="Оригинал, запечатан..." rows={2} className="input" style={{ resize: 'none' }} />
              </div>
              {!editId && (
                <div style={{ background: '#F2F3F5', borderRadius: 12, padding: '10px 12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showSaveTemplate} onChange={e => setShowSaveTemplate(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1E6FEB', cursor: 'pointer' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>Сохранить как шаблон</span>
                  </label>
                  {showSaveTemplate && (
                    <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Название шаблона" className="input" style={{ marginTop: 8, fontSize: 14 }} />
                  )}
                </div>
              )}
              {formError && <p style={{ color: '#E8251F', fontSize: 13 }}>{formError}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, paddingBottom: 4 }}>
                <button type="button" onClick={closeForm} className="btn-ghost">Отмена</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Сохраняем...' : editId ? '✓ Сохранить' : '+ Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
