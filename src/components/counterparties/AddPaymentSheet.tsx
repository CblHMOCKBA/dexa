'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PaymentDirection, PaymentMethod } from '@/types'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     '💵 Наличные',
  transfer: '📱 Перевод',
  crypto:   '₿ Крипто',
  other:    '📝 Другое',
}

type Props = {
  counterpartyId: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddPaymentSheet({ counterpartyId, onClose, onSuccess }: Props) {
  const router = useRouter()
  const [direction, setDirection] = useState<PaymentDirection>('in')
  const [amount, setAmount]       = useState('')
  const [method, setMethod]       = useState<PaymentMethod>('cash')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase.from('payments').insert({
      counterparty_id: counterpartyId,
      owner_id:        user.id,
      amount:          Number(amount),
      direction,
      method,
      note:            note.trim() || null,
    })

    setSaving(false)
    onSuccess()
    router.refresh()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '16px', paddingBottom: 'calc(24px + var(--sab))',
        animation: 'fade-up 0.2s var(--spring-snappy) both',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E1E6' }}/>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 16 }}>
          Добавить платёж
        </h2>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Направление */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { val: 'in',  label: '← Мне заплатили', bg: '#E6F9F3', color: '#006644', border: '#00B173' },
              { val: 'out', label: '→ Я заплатил',    bg: '#FFEBEA', color: '#A8170F', border: '#E8251F' },
            ] as const).map(opt => (
              <button key={opt.val} type="button" onClick={() => setDirection(opt.val)} style={{
                padding: '12px', borderRadius: 12, cursor: 'pointer',
                background: direction === opt.val ? opt.bg : '#F2F3F5',
                border: `1.5px solid ${direction === opt.val ? opt.border : 'transparent'}`,
                color: direction === opt.val ? opt.color : '#9498AB',
                fontSize: 13, fontWeight: 700, transition: 'all 0.12s',
              }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Сумма */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Сумма ₽ *
            </label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="10000" required min={1} autoFocus
              className="input"
              style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            />
          </div>

          {/* Метод */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Способ
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([m, l]) => (
                <button key={m} type="button" onClick={() => setMethod(m)} style={{
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  background: method === m ? '#1E6FEB' : '#F2F3F5',
                  color: method === m ? '#fff' : '#5A5E72',
                  border: 'none', fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Заметка */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Заметка
            </label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="За iPhone 15 Pro..." className="input" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
            <button type="submit" disabled={saving || !amount} className="btn-primary">
              {saving ? 'Сохраняем...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
