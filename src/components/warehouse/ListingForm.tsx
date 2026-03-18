'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, ListingTemplate } from '@/types'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'
import SerialNumberInput, { type SerialEntry } from '@/components/scanner/SerialNumberInput'
import { lookupProduct, type ProductData } from '@/lib/api/upc'

type FormData = {
  title: string; brand: string; model: string; condition: 'new' | 'used'
  price: string; quantity: string; cost_price: string; min_stock: string
  description: string; tags: string; upc: string
}

const EMPTY: FormData = {
  title: '', brand: '', model: '', condition: 'new',
  price: '', quantity: '1', cost_price: '', min_stock: '0',
  description: '', tags: '', upc: '',
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

type Props = {
  listing?: Listing
  template?: ListingTemplate
  showSaveAsTemplate?: boolean
}

export default function ListingForm({ listing, template, showSaveAsTemplate = true }: Props) {
  const router = useRouter()
  const [form, setForm]   = useState<FormData>(
    listing ? toForm(listing) : template ? toForm(template.data) : EMPTY
  )
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [saveAsTpl, setSaveAsTpl]   = useState(false)
  const [tplName, setTplName]       = useState('')

  // Сканер
  const [showScanner, setShowScanner]   = useState(false)
  const [scanning, setScanning]         = useState(false)  // идёт поиск по API
  const [scannedProduct, setScannedProduct] = useState<ProductData | null>(null)

  // Серийные номера
  const [serialEntries, setSerialEntries] = useState<SerialEntry[]>([])
  const isSmartphone = ['apple', 'samsung', 'xiaomi', 'huawei', 'google'].includes(
    form.brand.toLowerCase()
  )

  function f<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const margin = form.price && form.cost_price
    ? calcMargin(Number(form.price), Number(form.cost_price))
    : null

  // Обработка результата сканирования
  const handleScan = useCallback(async (result: ScanResult) => {
    setShowScanner(false)
    setScanning(true)

    f('upc', result.value)

    const supabase = createClient()
    const product  = await lookupProduct(result.value, supabase)

    if (product) {
      setScannedProduct(product)
      setForm(p => ({
        ...p,
        upc:         result.value,
        title:       product.title || p.title,
        brand:       product.brand ?? p.brand,
        model:       product.model ?? p.model,
        description: product.description ?? p.description,
      }))
    } else {
      // Не найдено — только UPC заполнен
      setForm(p => ({ ...p, upc: result.value }))
    }

    setScanning(false)
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.price) { setError('Заполни название и цену'); return }
    setSaving(true); setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

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
      upc:         form.upc || null,
    }

    let listingId: string

    if (listing) {
      const { data, error } = await supabase
        .from('listings').update(payload).eq('id', listing.id).select('id').single()
      if (error) { setError('Ошибка сохранения'); setSaving(false); return }
      listingId = data.id
    } else {
      const { data, error } = await supabase
        .from('listings').insert({ ...payload, seller_id: user.id }).select('id').single()
      if (error) { setError('Ошибка сохранения'); setSaving(false); return }
      listingId = data.id
    }

    // Сохраняем серийные номера
    const validSerials = serialEntries.filter(e => e.serial_number || e.imei)
    if (validSerials.length > 0) {
      await supabase.from('serial_items').insert(
        validSerials.map(e => ({
          listing_id:    listingId,
          serial_number: e.serial_number || null,
          imei:          e.imei || null,
          acquired_price: form.cost_price ? Number(form.cost_price) : null,
        }))
      )
    }

    // Шаблон
    if (saveAsTpl && tplName.trim()) {
      await supabase.from('listing_templates').insert({
        seller_id: user.id, name: tplName.trim(), data: payload,
      })
    }

    setSaving(false)
    router.push('/warehouse')
    router.refresh()
  }

  return (
    <>
      <form onSubmit={save} style={{
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 16,
        paddingBottom: 'calc(40px + var(--sab))',
      }}>

        {/* ── UPC Сканер ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button type="button" onClick={() => setShowScanner(true)}
              disabled={scanning}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px', borderRadius: 14,
                background: scannedProduct ? '#E6F9F3' : '#1E6FEB',
                border: scannedProduct ? '1.5px solid #00B173' : 'none',
                color: scannedProduct ? '#006644' : '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {scanning ? (
                <>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
                  Ищем в базе...
                </>
              ) : scannedProduct ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006644" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Найдено: {scannedProduct.source === 'internal' ? 'в каталоге Dexa' : 'в базе товаров'}
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                    <rect x="7" y="7" width="10" height="10" rx="1"/>
                  </svg>
                  Сканировать штрихкод
                </>
              )}
            </button>
          </div>

          {/* Результат сканирования */}
          {scannedProduct && (
            <div style={{
              background: '#F8F9FF', borderRadius: 12, padding: '10px 14px',
              border: '1px solid #E0E8FF', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {scannedProduct.image_url && (
                <img src={scannedProduct.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scannedProduct.title}
                </p>
                <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  UPC: {form.upc}
                  {scannedProduct.brand && ` · ${scannedProduct.brand}`}
                </p>
              </div>
              <button type="button" onClick={() => { setScannedProduct(null); f('upc', '') }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9498AB', fontSize: 18, flexShrink: 0,
              }}>×</button>
            </div>
          )}

          {form.upc && !scannedProduct && !scanning && (
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              UPC: {form.upc} · Не найден в базе — заполни вручную
            </p>
          )}
        </div>

        {/* Название */}
        <div>
          <label style={LABEL}>Название *</label>
          <input value={form.title} onChange={e => f('title', e.target.value)}
            placeholder="iPhone 15 Pro Max 256GB" required className="input" />
        </div>

        {/* Бренд + модель */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Бренд</label>
            <input value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Apple" className="input" />
          </div>
          <div>
            <label style={LABEL}>Модель</label>
            <input value={form.model} onChange={e => f('model', e.target.value)} placeholder="iPhone 15 Pro" className="input" />
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
                color: form.condition === c ? '#1249A8' : '#5A5E72',
                transition: 'all 0.12s',
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
            <input type="number" value={form.price} onChange={e => f('price', e.target.value)}
              placeholder="119900" required min={1} className="input" />
          </div>
          <div>
            <label style={LABEL}>Кол-во *</label>
            <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)}
              placeholder="1" required min={0} className="input" />
          </div>
        </div>

        {/* Серийные номера */}
        {Number(form.quantity) > 0 && (
          <SerialNumberInput
            quantity={Number(form.quantity)}
            onChange={setSerialEntries}
            isSmartphone={isSmartphone}
          />
        )}

        {/* Себестоимость + мин. остаток */}
        <div style={{ background: '#F8F9FF', borderRadius: 14, padding: '14px', border: '1px solid #E0E8FF' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            🔒 Только для вас
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={LABEL}>Себестоимость ₽</label>
              <input type="number" value={form.cost_price} onChange={e => f('cost_price', e.target.value)}
                placeholder="80000" min={0} className="input" style={{ background: '#fff' }} />
              {margin !== null && (
                <p style={{ fontSize: 12, marginTop: 5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: margin > 15 ? '#006644' : '#7A4F00' }}>
                  Маржа: +{margin}%
                </p>
              )}
            </div>
            <div>
              <label style={LABEL}>Мин. остаток 🔔</label>
              <input type="number" value={form.min_stock} onChange={e => f('min_stock', e.target.value)}
                placeholder="2" min={0} className="input" style={{ background: '#fff' }} />
            </div>
          </div>
        </div>

        {/* Теги */}
        <div>
          <label style={LABEL}>Теги</label>
          <input value={form.tags} onChange={e => f('tags', e.target.value)}
            placeholder="опт, срочно, новинка" className="input" />
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>Через запятую</p>
        </div>

        {/* Описание */}
        <div>
          <label style={LABEL}>Описание</label>
          <textarea value={form.description} onChange={e => f('description', e.target.value)}
            placeholder="Оригинал, запечатан..." rows={3} className="input" style={{ resize: 'none' }} />
        </div>

        {/* Шаблон */}
        {showSaveAsTemplate && !listing && (
          <div style={{ background: '#F2F3F5', borderRadius: 12, padding: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={saveAsTpl} onChange={e => setSaveAsTpl(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#1E6FEB', cursor: 'pointer' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>Сохранить как шаблон</span>
            </label>
            {saveAsTpl && (
              <input value={tplName} onChange={e => setTplName(e.target.value)}
                placeholder="Название шаблона" className="input" style={{ marginTop: 10 }} />
            )}
          </div>
        )}

        {error && <p style={{ color: '#E8251F', fontSize: 14, fontWeight: 500 }}>{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Сохраняем...' : listing ? '✓ Сохранить изменения' : '+ Добавить товар'}
        </button>
      </form>

      {/* Сканер оверлей */}
      {showScanner && (
        <BarcodeScanner
          mode="upc"
          hint="Наведи на штрихкод коробки или товара"
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
