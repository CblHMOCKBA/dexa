'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Counterparty } from '@/types'
import BackButton from '@/components/ui/BackButton'

type FormData = {
  name: string; company: string; phone: string; inn: string
  type: 'supplier' | 'buyer' | 'both'
  credit_limit: string; discount_pct: string; payment_delay_days: string
  tags: string; notes: string
}

const EMPTY: FormData = {
  name: '', company: '', phone: '', inn: '',
  type: 'both', credit_limit: '0', discount_pct: '0',
  payment_delay_days: '0', tags: '', notes: '',
}

function fromCounterparty(c: Counterparty): FormData {
  return {
    name:               c.name,
    company:            c.company ?? '',
    phone:              c.phone ?? '',
    inn:                c.inn ?? '',
    type:               c.type,
    credit_limit:       String(c.credit_limit),
    discount_pct:       String(c.discount_pct),
    payment_delay_days: String(c.payment_delay_days),
    tags:               (c.tags ?? []).join(', '),
    notes:              c.notes ?? '',
  }
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#9498AB', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

const TYPE_OPTIONS = [
  { val: 'buyer',    icon: '🛒', label: 'Покупатель', desc: 'Покупает у меня',        bg: '#E6F9F3', color: '#006644' },
  { val: 'supplier', icon: '📦', label: 'Поставщик',  desc: 'Я покупаю у него',       bg: '#EBF2FF', color: '#1249A8' },
  { val: 'both',     icon: '🤝', label: 'Оба',        desc: 'Покупаем друг у друга',  bg: '#F0E8FF', color: '#5B00CC' },
] as const

export default function CounterpartyForm({ counterparty }: { counterparty?: Counterparty }) {
  const router = useRouter()
  const [form, setForm]     = useState<FormData>(counterparty ? fromCounterparty(counterparty) : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function f<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Введи имя'); return }
    setSaving(true); setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      name:               form.name.trim(),
      company:            form.company.trim() || null,
      phone:              form.phone.trim() || null,
      inn:                form.inn.trim() || null,
      type:               form.type,
      credit_limit:       Number(form.credit_limit) || 0,
      discount_pct:       Math.min(100, Math.max(0, Number(form.discount_pct) || 0)),
      payment_delay_days: Number(form.payment_delay_days) || 0,
      tags:               form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes:              form.notes.trim() || null,
    }

    if (counterparty) {
      const { error: err } = await supabase
        .from('counterparties').update(payload).eq('id', counterparty.id)
      if (err) { setError('Ошибка сохранения'); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('counterparties').insert({ ...payload, owner_id: user.id })
      if (err) { setError('Ошибка сохранения'); setSaving(false); return }
    }

    setSaving(false)
    router.push('/counterparties')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/counterparties" />
        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', flex: 1 }}>
          {counterparty ? 'Редактировать' : 'Новый контрагент'}
        </h1>
      </div>

      <form onSubmit={save} style={{
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 16,
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Тип */}
        <div>
          <label style={LABEL}>Тип *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.val} type="button" onClick={() => f('type', opt.val)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', cursor: 'pointer',
                background: form.type === opt.val ? opt.bg : '#fff',
                border: `1.5px solid ${form.type === opt.val ? 'transparent' : '#E0E1E6'}`,
                borderRadius: 12, transition: 'all 0.12s', textAlign: 'left',
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: form.type === opt.val ? opt.color : '#1A1C21', marginBottom: 1 }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 12, color: '#9498AB' }}>{opt.desc}</p>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${form.type === opt.val ? opt.color : '#CDD0D8'}`,
                  background: form.type === opt.val ? opt.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {form.type === opt.val && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Имя */}
        <div>
          <label style={LABEL}>Имя / Название *</label>
          <input value={form.name} onChange={e => f('name', e.target.value)}
            placeholder="Михаил Дроздов" required className="input" autoFocus />
        </div>

        {/* Компания + телефон */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={LABEL}>Компания</label>
            <input value={form.company} onChange={e => f('company', e.target.value)}
              placeholder="ИП Дроздов" className="input" />
          </div>
          <div>
            <label style={LABEL}>Телефон</label>
            <input value={form.phone} onChange={e => f('phone', e.target.value)}
              placeholder="+7 999 000-00-00" type="tel" className="input" />
          </div>
        </div>

        {/* ИНН */}
        <div>
          <label style={LABEL}>ИНН</label>
          <input value={form.inn} onChange={e => f('inn', e.target.value)}
            placeholder="123456789012" maxLength={12} className="input" />
        </div>

        {/* Условия работы */}
        <div style={{ background: '#F8F9FF', borderRadius: 14, padding: '14px', border: '1px solid #E0E8FF' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            💼 Условия работы
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <label style={LABEL}>Кредит ₽</label>
              <input type="number" value={form.credit_limit}
                onChange={e => f('credit_limit', e.target.value)}
                placeholder="50000" min={0} className="input" style={{ background: '#fff' }} />
              <p style={{ fontSize: 10, color: '#9498AB', marginTop: 3 }}>Макс. долг</p>
            </div>
            <div>
              <label style={LABEL}>Скидка %</label>
              <input type="number" value={form.discount_pct}
                onChange={e => f('discount_pct', e.target.value)}
                placeholder="5" min={0} max={100} className="input" style={{ background: '#fff' }} />
              <p style={{ fontSize: 10, color: '#9498AB', marginTop: 3 }}>Авто в ордере</p>
            </div>
            <div>
              <label style={LABEL}>Отсрочка</label>
              <input type="number" value={form.payment_delay_days}
                onChange={e => f('payment_delay_days', e.target.value)}
                placeholder="14" min={0} className="input" style={{ background: '#fff' }} />
              <p style={{ fontSize: 10, color: '#9498AB', marginTop: 3 }}>Дней</p>
            </div>
          </div>
        </div>

        {/* Теги */}
        <div>
          <label style={LABEL}>Теги</label>
          <input value={form.tags} onChange={e => f('tags', e.target.value)}
            placeholder="VIP, оптовик, надёжный" className="input" />
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 4 }}>Через запятую</p>
        </div>

        {/* Заметки */}
        <div>
          <label style={LABEL}>Заметки</label>
          <textarea value={form.notes} onChange={e => f('notes', e.target.value)}
            placeholder="Работаем с 2020, всегда платит вовремя..." rows={3}
            className="input" style={{ resize: 'none' }} />
        </div>

        {error && <p style={{ color: '#E8251F', fontSize: 14, fontWeight: 500 }}>{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Сохраняем...' : counterparty ? '✓ Сохранить' : '+ Добавить'}
        </button>
      </form>
    </div>
  )
}
