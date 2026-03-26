'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BackButton from '@/components/ui/BackButton'

const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#5A5E72',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
}

const INPUT: React.CSSProperties = {
  width: '100%', background: '#F2F3F5', border: '1.5px solid transparent',
  borderRadius: 12, padding: '12px 14px', fontSize: 15, color: '#1A1C21',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui',
  transition: 'border-color 0.15s, background 0.15s',
}

export default function NewRequestClient({ userId }: { userId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    title:       '',
    brand:       '',
    model:       '',
    condition:   'any' as 'new' | 'used' | 'any',
    quantity:    '1',
    budget_min:  '',
    budget_max:  '',
    description: '',
    expires_days: '7',
  })

  function f(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Введи название товара'); return }
    if (!form.budget_max)   { setError('Укажи максимальный бюджет'); return }

    setSaving(true); setError(null)
    const supabase = createClient()

    const expires = new Date()
    expires.setDate(expires.getDate() + Number(form.expires_days))

    const { error: err } = await supabase.from('requests').insert({
      buyer_id:    userId,
      title:       form.title.trim(),
      brand:       form.brand.trim() || null,
      model:       form.model.trim() || null,
      condition:   form.condition,
      quantity:    Number(form.quantity) || 1,
      budget_min:  form.budget_min ? Number(form.budget_min) : null,
      budget_max:  Number(form.budget_max),
      description: form.description.trim() || null,
      expires_at:  expires.toISOString(),
    })

    if (err) { setError('Ошибка. Попробуй ещё раз'); setSaving(false); return }
    router.push('/feed?tab=requests')
    router.refresh()
  }

  return (
    <div className="page-with-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/feed" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>Новый запрос</h1>
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>Продавцы предложат свои цены</p>
        </div>
      </div>

      <form onSubmit={submit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Что ищешь */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 12 }}>Что ищешь?</p>

          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Название *</label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="iPhone 15 Pro 256GB" required
              style={INPUT}
              onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
              onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={LABEL}>Бренд</label>
              <input value={form.brand} onChange={e => f('brand', e.target.value)}
                placeholder="Apple" style={INPUT}
                onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
                onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={LABEL}>Модель</label>
              <input value={form.model} onChange={e => f('model', e.target.value)}
                placeholder="15 Pro" style={INPUT}
                onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
                onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
              />
            </div>
          </div>

          <div>
            <label style={LABEL}>Состояние</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['any', 'new', 'used'] as const).map(c => (
                <button key={c} type="button" onClick={() => f('condition', c)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: form.condition === c ? '#1E6FEB' : '#F2F3F5',
                  color: form.condition === c ? 'white' : '#5A5E72',
                  transition: 'all 0.15s',
                }}>
                  {c === 'any' ? 'Любое' : c === 'new' ? '✨ Новый' : '🔄 Б/У'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Бюджет */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 12 }}>Бюджет</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={LABEL}>От ₽</label>
              <input type="number" value={form.budget_min} onChange={e => f('budget_min', e.target.value)}
                placeholder="70 000" min={0} style={INPUT}
                onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
                onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={LABEL}>До ₽ *</label>
              <input type="number" value={form.budget_max} onChange={e => f('budget_max', e.target.value)}
                placeholder="90 000" min={1} required style={INPUT}
                onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
                onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
              />
            </div>
          </div>
        </div>

        {/* Детали */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', marginBottom: 12 }}>Детали</p>

          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Количество</label>
            <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)}
              min={1} style={{ ...INPUT, width: 100 }}
              onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
              onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Комментарий</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)}
              placeholder="Нужен в хорошем состоянии, предпочтительно с коробкой..."
              rows={3}
              style={{ ...INPUT, resize: 'none', lineHeight: 1.5 }}
              onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#1E6FEB' }}
              onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
            />
          </div>

          <div>
            <label style={LABEL}>Срок актуальности</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['1', '1 день'], ['3', '3 дня'], ['7', '7 дней'], ['14', '2 недели']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => f('expires_days', v)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: form.expires_days === v ? '#1E6FEB' : '#F2F3F5',
                  color: form.expires_days === v ? 'white' : '#5A5E72',
                  transition: 'all 0.15s',
                }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFEBEA', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: '#E8251F', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          padding: '15px', borderRadius: 14, border: 'none',
          background: saving ? '#9498AB' : '#1E6FEB', color: 'white',
          fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}>
          {saving ? 'Публикую...' : '📢 Опубликовать запрос'}
        </button>

      </form>
    </div>
  )
}
