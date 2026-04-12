'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, ListingTemplate } from '@/types'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'
import { lookupProduct, type ProductData } from '@/lib/api/upc'

type FormData = {
  title: string; brand: string; model: string; condition: 'new' | 'used'
  price: string; quantity: string; cost_price: string; min_stock: string
  description: string; tags: string; upc: string
  supplier: string; received_at: string
}

type SerialEntry = { serial_number: string; imei: string }

const EMPTY: FormData = {
  title: '', brand: '', model: '', condition: 'new',
  price: '', quantity: '1', cost_price: '', min_stock: '0',
  description: '', tags: '', upc: '',
  supplier: '', received_at: '',
}

function toForm(d: Partial<Listing>): FormData {
  return {
    title:       d.title ?? '',
    brand:       d.brand ?? '',
    model:       d.model ?? '',
    condition:   d.condition === 'used' ? 'used' : 'new',
    price:       d.price ? String(d.price) : '',
    quantity:    d.quantity ? String(d.quantity) : '1',
    cost_price:  d.cost_price ? String(d.cost_price) : '',
    min_stock:   String(d.min_stock ?? 0),
    description: d.description ?? '',
    tags:        Array.isArray(d.tags) ? d.tags.join(', ') : '',
    upc:         (d as { upc?: string }).upc ?? '',
    supplier:    (d as { supplier?: string }).supplier ?? '',
    received_at: (d as { received_at?: string }).received_at ?? '',
  }
}

function calcMargin(price: number, cost: number) {
  if (!cost || cost <= 0 || !price) return null
  return Math.round(((price - cost) / price) * 100)
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#9498AB', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

type ScanMode = 'upc' | 'serial' | 'imei' | null

type UPCStatus =
  | { state: 'idle' }
  | { state: 'searching' }
  | { state: 'found'; source: 'dexa' | 'external'; product: ProductData }
  | { state: 'not_found'; upc: string }
  | { state: 'saving' }
  | { state: 'saved' }

type Props = {
  listing?: Listing
  template?: ListingTemplate
  showSaveAsTemplate?: boolean
}

// ── Компонент добавления серийника при редактировании ──────────────────────
function AddSerialInEdit({
  listingId,
  onAdded,
}: {
  listingId: string
  onAdded: (s: { id: string; serial_number: string | null; imei: string | null; status: string }) => void
}) {
  const [open, setOpen]   = useState(false)
  const [sn, setSn]       = useState('')
  const [imei, setImei]   = useState('')
  const [saving, setSaving] = useState(false)
  const isPhone = true // всегда показываем IMEI поле при добавлении

  async function add() {
    if (!sn && !imei) return
    setSaving(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data, error } = await supabase.from('serial_items').insert({
      listing_id:    listingId,
      serial_number: sn.trim() || null,
      imei:          imei.replace(/\D/g, '').slice(0, 15) || null,
      status:        'available',
    }).select('id, serial_number, imei, status').single()

    if (!error && data) {
      onAdded(data)
      setSn(''); setImei(''); setOpen(false)
    }
    setSaving(false)
  }

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} style={{
      marginTop: 10, width: '100%', padding: '9px', borderRadius: 10,
      border: '1.5px dashed #C5D8FF', background: 'transparent',
      color: '#1E6FEB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}>
      + Добавить серийник
    </button>
  )

  return (
    <div style={{ marginTop: 10, background: '#fff', borderRadius: 12, padding: 12, border: '1.5px solid #1E6FEB' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Новый серийник
      </p>
      <input
        value={sn} onChange={e => setSn(e.target.value)}
        placeholder="S/N (напр. JTCWH5YW30)"
        style={{
          width: '100%', background: '#F8F9FF', border: '1.5px solid #E0E1E6',
          borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1A1C21',
          outline: 'none', marginBottom: 8, boxSizing: 'border-box',
          fontFamily: 'var(--font-mono)',
        }}
        onFocus={e => e.target.style.borderColor = '#1E6FEB'}
        onBlur={e => e.target.style.borderColor = '#E0E1E6'}
      />
      <input
        value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
        placeholder="IMEI (опционально)"
        inputMode="numeric" maxLength={15}
        style={{
          width: '100%', background: '#F8F9FF', border: '1.5px solid #E0E1E6',
          borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1A1C21',
          outline: 'none', marginBottom: 10, boxSizing: 'border-box',
          fontFamily: 'var(--font-mono)',
        }}
        onFocus={e => e.target.style.borderColor = '#1E6FEB'}
        onBlur={e => e.target.style.borderColor = '#E0E1E6'}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { setOpen(false); setSn(''); setImei('') }} style={{
          flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid #E0E1E6',
          background: '#fff', color: '#5A5E72', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Отмена
        </button>
        <button type="button" onClick={add} disabled={saving || (!sn && !imei)} style={{
          flex: 2, padding: '9px', borderRadius: 10, border: 'none',
          background: (sn || imei) && !saving ? '#1E6FEB' : '#E0E1E6',
          color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          {saving ? 'Сохраняем...' : '✓ Сохранить'}
        </button>
      </div>
    </div>
  )
}

export default function ListingForm({ listing, template, showSaveAsTemplate = true }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(
    listing ? toForm(listing) : template ? toForm(template.data) : EMPTY
  )
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [saveAsTpl, setSaveAsTpl] = useState(false)
  const [tplName, setTplName]     = useState('')
  const [upcStatus, setUpcStatus] = useState<UPCStatus>({ state: 'idle' })
  const [scanMode, setScanMode]   = useState<ScanMode>(null)
  const [scanIdx, setScanIdx]     = useState<number | null>(null)

  const qty = Math.max(1, Number(form.quantity) || 1)
  const [serials, setSerials] = useState<SerialEntry[]>(() =>
    Array.from({ length: qty }, () => ({ serial_number: '', imei: '' }))
  )
  // Существующие серийники для режима редактирования
  const [existingSerials, setExistingSerials] = useState<Array<{ id: string; serial_number: string | null; imei: string | null; status: string }>>([])
  const [loadingSerials, setLoadingSerials] = useState(false)
  const snRefs   = useRef<(HTMLInputElement | null)[]>([])
  const imeiRefs = useRef<(HTMLInputElement | null)[]>([])

  const isSmartphone = ['apple', 'samsung', 'xiaomi', 'huawei', 'google', 'nothing']
    .includes(form.brand.toLowerCase())

  useEffect(() => {
    setSerials(prev => {
      const newLen = Math.max(1, Number(form.quantity) || 1)
      if (prev.length === newLen) return prev
      if (prev.length < newLen)
        return [...prev, ...Array.from({ length: newLen - prev.length }, () => ({ serial_number: '', imei: '' }))]
      return prev.slice(0, newLen)
    })
  }, [form.quantity])

  // Загружаем существующие серийники при редактировании
  useEffect(() => {
    if (!listing) return
    setLoadingSerials(true)
    const supabase = createClient()
    supabase.from('serial_items')
      .select('id, serial_number, imei, status')
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setExistingSerials(data ?? [])
        setLoadingSerials(false)
      })
  }, [listing])

  function f<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function updateSerial(idx: number, field: keyof SerialEntry, value: string) {
    setSerials(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  // UPC flow
  const handleUPCScan = useCallback(async (result: ScanResult) => {
    setScanMode(null)
    setUpcStatus({ state: 'searching' })
    f('upc', result.value)

    const supabase = createClient()
    const product  = await lookupProduct(result.value, supabase)

    if (product) {
      setForm(p => ({
        ...p,
        upc:         result.value,
        title:       product.title || p.title,
        brand:       product.brand ?? p.brand,
        model:       product.model ?? p.model,
        description: product.description ?? p.description,
      }))
      setUpcStatus({ state: 'found', source: product.source === 'internal' ? 'dexa' : 'external', product })
      // Автофокус на цену
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('[data-field="price"]')?.focus()
      }, 300)
    } else {
      setForm(p => ({ ...p, upc: result.value }))
      setUpcStatus({ state: 'not_found', upc: result.value })
    }
  }, [])

  // Сохранить в каталог Dexa
  async function saveToDexa() {
    if (upcStatus.state !== 'not_found') return
    if (!form.title || !form.brand) { setError('Заполни название и бренд'); return }
    setUpcStatus({ state: 'saving' })
    const supabase = createClient()
    await supabase.from('product_catalog').upsert({
      upc:         upcStatus.upc,
      title:       form.title.trim(),
      brand:       form.brand.trim() || null,
      model:       form.model.trim() || null,
      description: form.description.trim() || null,
      source:      'internal',
    }, { onConflict: 'upc' })
    setUpcStatus({ state: 'saved' })
  }

  // S/N + IMEI flow
  const handleSerialScan = useCallback((result: ScanResult, idx: number, forcedMode?: ScanMode) => {
    const mode = forcedMode ?? scanMode

    // Ключевая защита: если режим 'serial' и сканер опознал IMEI-формат
    // — проверяем не заполнен ли уже IMEI у этой позиции.
    // Если IMEI уже есть — это повторное считывание той же коробки,
    // игнорируем и НЕ закрываем сканер, ждём настоящий S/N.
    if (mode === 'serial' && result.type === 'imei') {
      const currentImei = serials[idx]?.imei
      if (currentImei) {
        // IMEI уже заполнен — просто игнорируем, сканер остаётся открытым
        return
      }
    }

    if (mode === 'serial') {
      // В режиме серийника пишем в serial_number
      setScanMode(null); setScanIdx(null)
      updateSerial(idx, 'serial_number', result.value)
      if (isSmartphone) {
        setTimeout(() => imeiRefs.current[idx]?.focus(), 100)
      } else {
        setTimeout(() => { const n = idx + 1; if (n < qty) snRefs.current[n]?.focus() }, 100)
      }
    } else if (mode === 'imei') {
      // IMEI — только цифры, минимум 14 символов
      // Если схватили серийник с буквами — игнорируем, сканер ждёт дальше
      const digitsOnly = result.value.replace(/\D/g, '')
      if (digitsOnly.length < 14) return  // не IMEI — ждём
      setScanMode(null); setScanIdx(null)
      updateSerial(idx, 'imei', digitsOnly.slice(0, 15))
      setTimeout(() => { const n = idx + 1; if (n < qty) snRefs.current[n]?.focus() }, 100)
    } else {
      // Авто-режим
      setScanMode(null); setScanIdx(null)
      if (result.type === 'imei') {
        updateSerial(idx, 'imei', result.value)
        setTimeout(() => { const n = idx + 1; if (n < qty) snRefs.current[n]?.focus() }, 100)
      } else {
        updateSerial(idx, 'serial_number', result.value)
        if (isSmartphone) {
          setTimeout(() => imeiRefs.current[idx]?.focus(), 100)
        } else {
          setTimeout(() => { const n = idx + 1; if (n < qty) snRefs.current[n]?.focus() }, 100)
        }
      }
    }
  }, [qty, isSmartphone, serials])

  const margin = form.price && form.cost_price
    ? calcMargin(Number(form.price), Number(form.cost_price)) : null
  const filledSerials = serials.filter(s => s.serial_number || s.imei).length

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.price) { setError('Заполни название и цену'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      title: form.title.trim(), brand: form.brand.trim() || null,
      model: form.model.trim() || null, condition: form.condition,
      price: Number(form.price), quantity: Number(form.quantity) || 1,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      min_stock: Number(form.min_stock) || 0,
      description: form.description.trim() || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      upc: form.upc || null,
    }
    let listingId: string
    if (listing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('listings') as any).update(payload).eq('id', listing.id).select('id').single()
      if (error) { setError('Ошибка сохранения'); setSaving(false); return }
      listingId = data.id
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('listings') as any).insert({ ...payload, seller_id: user.id }).select('id').single()
      if (error) { setError('Ошибка сохранения'); setSaving(false); return }
      listingId = data.id
    }
    if (!listing) {
      const valid = serials.filter(s => s.serial_number || s.imei)
      if (valid.length > 0) {
        await supabase.from('serial_items').insert(
          valid.map(s => ({ listing_id: listingId, serial_number: s.serial_number || null, imei: s.imei || null, acquired_price: form.cost_price ? Number(form.cost_price) : null }))
        )
      }
    }
    if (saveAsTpl && tplName.trim()) {
      await supabase.from('listing_templates').insert({ seller_id: user.id, name: tplName.trim(), data: payload })
    }
    setSaving(false)
    router.push('/warehouse')
    router.refresh()
  }

  return (
    <>
      <form onSubmit={save} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 'calc(80px + var(--sab))' }}>

        {/* ── UPC — показываем только при создании ── */}
        {!listing && (
        <div style={{ background: '#F8F9FF', borderRadius: 16, padding: '14px', border: '1px solid #E0E8FF' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            {listing ? 'Штрихкод товара (UPC)' : 'Шаг 1 · Штрихкод товара (UPC)'}
          </p>

          {!listing && upcStatus.state === 'idle' && (
            <button type="button" onClick={() => setScanMode('upc')} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '13px', borderRadius: 12, background: '#1E6FEB', color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
              </svg>
              Сканировать штрихкод (UPC)
            </button>
          )}

          {upcStatus.state === 'searching' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px', background: '#EBF2FF', borderRadius: 12 }}>
              <div style={{ width: 18, height: 18, border: '2px solid #1E6FEB', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1249A8' }}>Ищем в каталоге Dexa...</p>
            </div>
          )}

          {upcStatus.state === 'found' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#E6F9F3', borderRadius: 12, border: '1.5px solid #00B173' }}>
              {upcStatus.product.image_url && (
                <img src={upcStatus.product.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#006644', marginBottom: 2 }}>
                  ✓ {upcStatus.source === 'dexa' ? 'Найдено в каталоге Dexa' : 'Найдено в базе товаров'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {upcStatus.product.title}
                </p>
                <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  UPC: {form.upc}
                </p>
              </div>
              <button type="button" onClick={() => { setUpcStatus({ state: 'idle' }); f('upc', '') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9498AB', fontSize: 18 }}>×
              </button>
            </div>
          )}

          {(upcStatus.state === 'not_found' || upcStatus.state === 'saving' || upcStatus.state === 'saved') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FFF4E0', borderRadius: 10, border: '1px solid #F5A623' }}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#7A4F00' }}>Товар не найден в базе</p>
                  <p style={{ fontSize: 11, color: '#9A6800', fontFamily: 'var(--font-mono)' }}>UPC: {form.upc}</p>
                </div>
                <button type="button" onClick={() => { setUpcStatus({ state: 'idle' }); f('upc', '') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9498AB', fontSize: 18 }}>×</button>
              </div>
              <p style={{ fontSize: 12, color: '#5A5E72', lineHeight: 1.5 }}>
                Заполни название и бренд ниже — следующий дилер с этим товаром получит данные автоматически из каталога Dexa.
              </p>
              {upcStatus.state === 'saved' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#E6F9F3', borderRadius: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00B173" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#006644' }}>Сохранено в каталог Dexa ✓</p>
                </div>
              ) : (
                <button type="button" onClick={saveToDexa}
                  disabled={!form.title || !form.brand || upcStatus.state === 'saving'}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10,
                    background: form.title && form.brand ? '#1E6FEB' : '#F2F3F5',
                    color: form.title && form.brand ? '#fff' : '#9498AB',
                    border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: form.title && form.brand ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {upcStatus.state === 'saving' ? (
                    <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>Сохраняем...</>
                  ) : '💾 Сохранить в каталог Dexa'}
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Название */}
        <div>
          <label style={LABEL}>Название *</label>
          <input value={form.title} onChange={e => f('title', e.target.value)}
            placeholder="iPhone 17 Pro Max 256GB Silver" required className="input" />
        </div>

        {/* Бренд + модель */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Бренд</label>
            <input value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Apple" className="input" />
          </div>
          <div>
            <label style={LABEL}>Модель</label>
            <input value={form.model} onChange={e => f('model', e.target.value)} placeholder="iPhone 17 Pro" className="input" />
          </div>
        </div>

        {/* Состояние */}
        <div>
          <label style={LABEL}>Состояние *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['new', 'used'] as const).map(c => (
              <button key={c} type="button" onClick={() => f('condition', c)} style={{
                padding: '12px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                border: form.condition === c ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                background: form.condition === c ? '#EBF2FF' : '#fff',
                color: form.condition === c ? '#1249A8' : '#5A5E72', transition: 'all 0.12s',
              }}>
                {c === 'new' ? '✨ Новый' : '🔄 Б/У'}
              </button>
            ))}
          </div>
        </div>

        {/* Цена + кол-во */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Цена ₽ *</label>
            <input data-field="price" type="number" value={form.price} onChange={e => f('price', e.target.value)}
              placeholder="119900" required min={1} className="input" />
          </div>
          <div>
            <label style={LABEL}>Кол-во *</label>
            <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)}
              placeholder="1" required min={1} className="input" />
          </div>
        </div>

        {/* ── Серийники ── */}
        {listing && (
          <div style={{ background: '#F8F9FF', borderRadius: 16, padding: '14px', border: '1px solid #E0E8FF' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Серийные номера · {existingSerials.length} шт
            </p>
            {loadingSerials ? (
              <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '8px 0' }}>Загрузка...</p>
            ) : existingSerials.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9498AB' }}>Серийники не добавлялись при создании</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {existingSerials.map((s, i) => (
                  <div key={s.id} style={{
                    background: '#fff', borderRadius: 10, padding: '10px 12px',
                    border: '1.5px solid #E0E1E6',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', minWidth: 20 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {s.serial_number && (
                        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#1A1C21', fontWeight: 600 }}>
                          S/N: {s.serial_number}
                        </p>
                      )}
                      {s.imei && (
                        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#5A5E72' }}>
                          IMEI: {s.imei}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, flexShrink: 0,
                      background: s.status === 'available' ? '#E6F9F3' : s.status === 'sold' ? '#F2F3F5' : '#FFF4E0',
                      color: s.status === 'available' ? '#006644' : s.status === 'sold' ? '#9498AB' : '#7A4F00',
                    }}>
                      {s.status === 'available' ? 'В наличии' : s.status === 'sold' ? 'Продан' : s.status === 'reserved' ? 'Бронь' : s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Добавить новый серийник в режиме редактирования */}
            {!loadingSerials && (
              <AddSerialInEdit listingId={listing?.id ?? ''} onAdded={s => {
                setExistingSerials(prev => [...prev, s])
                // Авто-увеличение количества при добавлении серийника
                const newQty = String(Number(form.quantity) + 1)
                setForm(prev => ({ ...prev, quantity: newQty }))
                // Синхронизируем в БД
                const supabase = createClient()
                supabase.from('listings').update({ quantity: Number(newQty) }).eq('id', listing!.id)
              }} />
            )}
          </div>
        )}

        {/* ── Шаг 2: Серийные номера (только при создании) ── */}
        {!listing && (
          <div style={{ background: '#F8F9FF', borderRadius: 16, padding: '14px', border: '1px solid #E0E8FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Шаг 2 · Серийные номера
              </p>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: filledSerials === qty ? '#006644' : '#9498AB' }}>
                {filledSerials}/{qty}
              </span>
            </div>

            {qty > 1 && (
              <div style={{ height: 3, background: '#E0E8FF', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: filledSerials === qty ? '#00B173' : '#1E6FEB', width: `${(filledSerials / qty) * 100}%`, transition: 'width 0.3s', borderRadius: 2 }}/>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {serials.map((entry, idx) => (
                <div key={idx} style={{ background: '#fff', borderRadius: 12, padding: '12px', border: `1.5px solid ${entry.serial_number || entry.imei ? '#1E6FEB' : '#E0E1E6'}` }}>
                  {qty > 1 && <p style={{ fontSize: 11, fontWeight: 700, color: '#1249A8', marginBottom: 8 }}>Единица {idx + 1} из {qty}</p>}

                  <div style={{ display: 'flex', gap: 8, marginBottom: isSmartphone ? 8 : 0 }}>
                    <input
                      ref={el => { snRefs.current[idx] = el }}
                      value={entry.serial_number}
                      onChange={e => updateSerial(idx, 'serial_number', e.target.value)}
                      placeholder="S/N (напр. JTCWH5YW30)"
                      style={{ flex: 1, background: '#F8F9FF', border: '1.5px solid #E0E1E6', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1A1C21', outline: 'none', fontFamily: 'var(--font-mono)' }}
                      onFocus={e => { e.target.style.borderColor = '#1E6FEB' }}
                      onBlur={e => { e.target.style.borderColor = '#E0E1E6' }}
                    />
                    <button type="button" onClick={() => { setScanIdx(idx); setScanMode('serial') }}
                      style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: '#EBF2FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2">
                        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                        <rect x="7" y="7" width="10" height="10" rx="1"/>
                      </svg>
                    </button>
                  </div>

                  {isSmartphone && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        ref={el => { imeiRefs.current[idx] = el }}
                        value={entry.imei}
                        onChange={e => updateSerial(idx, 'imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                        placeholder="IMEI (опционально)"
                        maxLength={15} inputMode="numeric"
                        style={{ flex: 1, background: '#F8F9FF', border: `1.5px solid ${entry.imei && entry.imei.length !== 15 ? '#F5A623' : '#E0E1E6'}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1A1C21', outline: 'none', fontFamily: 'var(--font-mono)' }}
                        onFocus={e => { e.target.style.borderColor = '#1E6FEB' }}
                        onBlur={e => { e.target.style.borderColor = entry.imei && entry.imei.length !== 15 ? '#F5A623' : '#E0E1E6' }}
                      />
                      <button type="button" onClick={() => { setScanIdx(idx); setScanMode('imei') }}
                        style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: '#F0E8FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B00CC" strokeWidth="2">
                          <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                          <rect x="7" y="7" width="10" height="10" rx="1"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {(entry.serial_number || entry.imei) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {entry.serial_number && <span style={{ fontSize: 10, background: '#EBF2FF', color: '#1249A8', borderRadius: 5, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>S/N: {entry.serial_number}</span>}
                      {entry.imei && <span style={{ fontSize: 10, background: '#F0E8FF', color: '#5B00CC', borderRadius: 5, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>IMEI: {entry.imei}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Себестоимость */}
        <div style={{ background: '#F8F9FF', borderRadius: 14, padding: '14px', border: '1px solid #E0E8FF' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>🔒 Только для вас</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={LABEL}>Себестоимость ₽</label>
              <input type="number" value={form.cost_price} onChange={e => f('cost_price', e.target.value)}
                placeholder="80000" min={0} className="input" style={{ background: '#fff' }} />
              {margin !== null && <p style={{ fontSize: 12, marginTop: 5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: margin > 15 ? '#006644' : '#7A4F00' }}>Маржа: +{margin}%</p>}
            </div>
            <div>
              <label style={LABEL}>Мин. остаток 🔔</label>
              <input type="number" value={form.min_stock} onChange={e => f('min_stock', e.target.value)}
                placeholder="2" min={0} className="input" style={{ background: '#fff' }} />
            </div>
          </div>
        </div>

        <div>
          <label style={LABEL}>Теги</label>
          <input value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="опт, срочно, новинка" className="input" />
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>Через запятую</p>
        </div>

        <div>
          <label style={LABEL}>Поставщик</label>
          <input value={form.supplier} onChange={e => f('supplier', e.target.value)}
            placeholder="Имя или компания поставщика"
            className="input" />
        </div>

        <div>
          <label style={LABEL}>Дата поступления</label>
          <input value={form.received_at} onChange={e => f('received_at', e.target.value)}
            type="date" className="input" style={{ colorScheme: 'light' }} />
        </div>
        <div>
          <label style={LABEL}>Описание</label>
          <textarea value={form.description} onChange={e => f('description', e.target.value)}
            placeholder="Оригинал, запечатан..." rows={3} className="input" style={{ resize: 'none' }} />
        </div>

        {showSaveAsTemplate && !listing && (
          <div style={{ background: '#F2F3F5', borderRadius: 12, padding: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={saveAsTpl} onChange={e => setSaveAsTpl(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#1E6FEB', cursor: 'pointer' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>Сохранить как шаблон</span>
            </label>
            {saveAsTpl && <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Название шаблона" className="input" style={{ marginTop: 10 }} />}
          </div>
        )}

        {error && <p style={{ color: '#E8251F', fontSize: 14, fontWeight: 500 }}>{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Сохраняем...' : listing ? '✓ Сохранить изменения' : '+ Добавить товар'}
        </button>
      </form>

      {scanMode === 'upc' && (
        <BarcodeScanner mode="upc" hint="Наведи рамку на штрихкод JAN/UPC на коробке" onScan={handleUPCScan} onClose={() => setScanMode(null)} />
      )}
      {scanMode === 'serial' && scanIdx !== null && (
        <BarcodeScanner mode="serial" hint="Перемести рамку на штрихкод серийника" onScan={r => handleSerialScan(r, scanIdx)} onClose={() => { setScanMode(null); setScanIdx(null) }} />
      )}
      {scanMode === 'imei' && scanIdx !== null && (
        <BarcodeScanner mode="imei" hint="Перемести рамку на штрихкод IMEI/MEID" onScan={r => handleSerialScan(r, scanIdx!, 'imei')} onClose={() => { setScanMode(null); setScanIdx(null) }} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
