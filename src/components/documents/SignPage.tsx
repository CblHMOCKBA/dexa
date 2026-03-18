'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  signCode: string
  document: {
    id: string
    number: string
    type: string
    status: string
    created_at: string
    signed_at?: string
    signed_by_name?: string
    owner?: { name: string; shop_name?: string; location?: string }
    order?: { total_price: number; listing?: { title: string } }
    items: Array<{ title: string; quantity: number; price: number; serial_item?: { serial_number?: string } }>
  }
}

export default function SignPage({ signCode, document: doc }: Props) {
  const [name, setName]       = useState('')
  const [signing, setSigning] = useState(false)
  const [signed, setSigned]   = useState(doc.status === 'signed')
  const [error, setError]     = useState<string | null>(null)

  const totalPrice = doc.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const typeLabel  = doc.type === 'invoice' ? 'Товарная накладная' : 'Акт приёма-передачи'

  async function sign() {
    if (!name.trim()) { setError('Введи своё имя'); return }
    setSigning(true); setError(null)

    const supabase = createClient()
    const ua = navigator.userAgent

    const { error: err } = await supabase.rpc('sign_document', {
      p_sign_code: signCode,
      p_name:      name.trim(),
      p_ua:        ua,
    })

    if (err) { setError('Ошибка подписания. Попробуй ещё раз.'); setSigning(false); return }
    setSigned(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F3F5', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', paddingTop: 'calc(24px + var(--sat))' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Шапка */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#F0B90B' }}>D</span>EXA
          </p>
          <p style={{ fontSize: 13, color: '#9498AB', marginTop: 4 }}>Платформа B2B торговли</p>
        </div>

        {/* Карточка документа */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EBF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              📄
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21' }}>{doc.number}</p>
              <p style={{ fontSize: 12, color: '#9498AB', marginTop: 1 }}>
                {typeLabel} · {new Date(doc.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Продавец */}
          {doc.owner && (
            <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 3 }}>Продавец</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>{doc.owner.name}</p>
              {doc.owner.shop_name && <p style={{ fontSize: 12, color: '#9498AB' }}>{doc.owner.shop_name}{doc.owner.location ? `, ${doc.owner.location}` : ''}</p>}
            </div>
          )}

          {/* Товары */}
          <div style={{ marginBottom: 12 }}>
            {doc.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: i < doc.items.length - 1 ? '1px solid #F0F1F4' : 'none' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{item.title}</p>
                  {item.serial_item?.serial_number && (
                    <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      S/N: {item.serial_item.serial_number}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>{item.quantity} шт.</p>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#1A1C21', flexShrink: 0 }}>
                  {(item.price * item.quantity).toLocaleString('ru-RU')} ₽
                </p>
              </div>
            ))}
          </div>

          {/* Итого */}
          <div style={{ background: '#1E6FEB', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Итого</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {totalPrice.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>

        {/* Подписание */}
        {signed ? (
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#E6F9F3', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              ✅
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#006644', marginBottom: 6 }}>Документ подписан</p>
            <p style={{ fontSize: 13, color: '#9498AB' }}>
              {doc.signed_by_name && `Подписал: ${doc.signed_by_name}`}
              {doc.signed_at && (
                <><br/>{new Date(doc.signed_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</>
              )}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>
              Подтвердить получение
            </p>
            <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 14, lineHeight: 1.5 }}>
              Нажимая кнопку, вы подтверждаете получение товара согласно накладной {doc.number}.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ваше имя *
              </label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Иван Петров" className="input"
              />
            </div>
            {error && <p style={{ color: '#E8251F', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <button onClick={sign} disabled={signing || !name.trim()} className="btn-primary" style={{ width: '100%' }}>
              {signing ? 'Подписываем...' : '✓ Подтверждаю получение'}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#CDD0D8' }}>
          Документ сформирован платформой DEXA · {doc.number}
        </p>
      </div>
    </div>
  )
}
