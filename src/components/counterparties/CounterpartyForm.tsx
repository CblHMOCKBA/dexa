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
  const [dexaProfileId, setDexaProfileId] = useState<string | null>(counterparty?.dexa_profile_id ?? null)

  // Dexa user search
  const [dexaSearch, setDexaSearch]       = useState('')
  const [dexaResults, setDexaResults]     = useState<{ id: string; name: string; location: string | null; rating: number }[]>([])
  const [dexaSearching, setDexaSearching] = useState(false)
  const [dexaLinked, setDexaLinked]       = useState<{ id: string; name: string; location: string | null } | null>(null)

  async function searchDexa() {
    if (!dexaSearch.trim()) return
    setDexaSearching(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let query = supabase.from('profiles')
      .select('id, name, location, rating')
      .ilike('name', `%${dexaSearch.trim()}%`)
      .limit(8)
    if (user) query = query.neq('id', user.id)
    const { data } = await query
    setDexaResults(data ?? [])
    setDexaSearching(false)
  }

  function selectDexaUser(p: { id: string; name: string; location: string | null }) {
    setDexaProfileId(p.id)
    setDexaLinked(p)
    // Автозаполнение имени если пустое
    if (!form.name.trim()) setForm(prev => ({ ...prev, name: p.name }))
    setDexaResults([])
    setDexaSearch('')
  }

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
        .from('counterparties').update({ ...payload, dexa_profile_id: dexaProfileId }).eq('id', counterparty.id)
      if (err) { setError('Ошибка сохранения'); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('counterparties').insert({ ...payload, owner_id: user.id, dexa_profile_id: dexaProfileId })
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

        {/* Привязка к Dexa */}
        <div style={{ background: '#F8F9FF', borderRadius: 14, padding: '14px', border: '1px solid #E0E8FF' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1249A8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            🔗 Привязать к аккаунту Dexa
          </p>

          {dexaLinked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1.5px solid #C5D9F5' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EBF2FF', color: '#1249A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                {dexaLinked.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21' }}>{dexaLinked.name}</p>
                {dexaLinked.location && <p style={{ fontSize: 11, color: '#9498AB' }}>{dexaLinked.location}</p>}
              </div>
              <span style={{ fontSize: 9, background: '#1E6FEB', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>DEXA</span>
              <button type="button" onClick={() => { setDexaLinked(null); setDexaProfileId(null) }} style={{
                width: 24, height: 24, borderRadius: 6, border: 'none', background: '#FFEBEA',
                color: '#E8251F', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>×</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={dexaSearch} onChange={e => setDexaSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchDexa())}
                  placeholder="Поиск по имени в Dexa..."
                  style={{
                    flex: 1, background: '#fff', border: '1.5px solid #E0E1E6',
                    borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1A1C21',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button type="button" onClick={searchDexa} disabled={dexaSearching || !dexaSearch.trim()} style={{
                  padding: '0 14px', borderRadius: 10, border: 'none',
                  background: dexaSearch.trim() ? '#1E6FEB' : '#E0E1E6',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>
                  {dexaSearching ? '...' : '🔍'}
                </button>
              </div>
              {dexaResults.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dexaResults.map(p => (
                    <button type="button" key={p.id} onClick={() => selectDexaUser(p)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10, border: '1px solid #E0E1E6',
                      background: '#fff', cursor: 'pointer', textAlign: 'left',
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EBF2FF', color: '#1249A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {p.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{p.name}</p>
                        {p.location && <p style={{ fontSize: 11, color: '#9498AB' }}>{p.location}</p>}
                      </div>
                      {p.rating > 0 && <span style={{ fontSize: 10, color: '#F0B90B', fontWeight: 700 }}>★ {p.rating.toFixed(1)}</span>}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: '#9498AB', marginTop: 8 }}>Необязательно · можно добавить позже</p>
            </>
          )}
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
