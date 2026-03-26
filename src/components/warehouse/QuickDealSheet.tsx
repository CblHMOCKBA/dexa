'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type SerialItem = {
  id: string
  serial_number: string | null
  imei: string | null
  status: string
}

type Counterparty = {
  id: string
  name: string
  type: string
  company: string | null
}

type Listing = {
  id: string
  title: string
  price: number
  quantity: number
}

type Props = {
  listing: Listing
  userId: string
  onClose: () => void
}

type Step = 'serial' | 'counterparty' | 'confirm'

export default function QuickDealSheet({ listing, userId, onClose }: Props) {
  const router = useRouter()

  const [step, setStep]                   = useState<Step>('serial')
  const [serials, setSerials]             = useState<SerialItem[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loadingSerials, setLoadingSerials] = useState(true)
  const [loadingCPs, setLoadingCPs]       = useState(false)

  const [selectedSerial, setSelectedSerial] = useState<SerialItem | null>(null)
  const [noSerial, setNoSerial]           = useState(false)
  const [selectedCP, setSelectedCP]       = useState<Counterparty | null>(null)
  const [price, setPrice]                 = useState(listing.price.toString())
  const [searchCP, setSearchCP]           = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // Load serials
  useEffect(() => {
    const supabase = createClient()
    supabase.from('serial_items')
      .select('id, serial_number, imei, status')
      .eq('listing_id', listing.id)
      .eq('status', 'available')
      .then(({ data }) => {
        setSerials(data ?? [])
        setLoadingSerials(false)
        // Если серийников нет вообще — сразу пропускаем шаг
        if (!data || data.length === 0) setNoSerial(true)
      })
  }, [listing.id])

  // Load counterparties
  useEffect(() => {
    if (step !== 'counterparty') return
    setLoadingCPs(true)
    const supabase = createClient()
    supabase.from('counterparties')
      .select('id, name, type, company')
      .eq('owner_id', userId)
      .in('type', ['buyer', 'both'])
      .order('name')
      .then(({ data }) => {
        setCounterparties(data ?? [])
        setLoadingCPs(false)
      })
  }, [step, userId])

  const filteredCPs = counterparties.filter(cp =>
    cp.name.toLowerCase().includes(searchCP.toLowerCase()) ||
    (cp.company ?? '').toLowerCase().includes(searchCP.toLowerCase())
  )

  async function completeDeal() {
    if (!selectedCP) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/quick-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id:       listing.id,
          counterparty_id:  selectedCP.id,
          serial_item_id:   selectedSerial?.id ?? null,
          price:            Number(price),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка сервера')

      router.refresh()
      onClose()
      router.push(`/orders/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 101, background: 'white',
        borderRadius: '20px 20px 0 0',
        maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        animation: 'slide-up 0.3s var(--spring-smooth) both',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, background: '#E0E1E6', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid #F2F3F5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>
                {step === 'serial' ? '📦 Выбери устройство' :
                 step === 'counterparty' ? '👤 Кому продаёшь?' :
                 '✅ Подтвердить сделку'}
              </p>
              <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>{listing.title}</p>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none',
              background: '#F2F3F5', cursor: 'pointer', fontSize: 18, color: '#5A5E72',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {(['serial', 'counterparty', 'confirm'] as Step[]).map((s, i) => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: step === s ? '#1E6FEB' :
                  (['serial', 'counterparty', 'confirm'].indexOf(step) > i) ? '#00B173' : '#E0E1E6',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── ШАГ 1: СЕРИЙНИК ── */}
          {step === 'serial' && (
            <div>
              {loadingSerials ? (
                <p style={{ color: '#9498AB', textAlign: 'center', padding: '20px 0' }}>Загрузка...</p>
              ) : serials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: 14, color: '#9498AB', marginBottom: 16 }}>
                    Серийники не указаны для этого товара
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {serials.map(s => (
                    <button key={s.id} onClick={() => setSelectedSerial(s)} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: selectedSerial?.id === s.id ? '#EBF2FF' : '#F8F9FB',
                      outline: selectedSerial?.id === s.id ? '2px solid #1E6FEB' : '1px solid #E0E1E6',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: selectedSerial?.id === s.id ? '#1E6FEB' : '#E0E1E6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedSerial?.id === s.id && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {s.serial_number && (
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', fontFamily: 'var(--font-mono)' }}>
                            S/N: {s.serial_number}
                          </p>
                        )}
                        {s.imei && (
                          <p style={{ fontSize: 12, color: '#5A5E72', fontFamily: 'var(--font-mono)' }}>
                            IMEI: {s.imei}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => { setSelectedSerial(null); setNoSerial(true) }} style={{
                width: '100%', padding: '11px', borderRadius: 10,
                border: noSerial && !selectedSerial ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                background: noSerial && !selectedSerial ? '#EBF2FF' : 'white',
                color: noSerial && !selectedSerial ? '#1E6FEB' : '#5A5E72',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Без серийника
              </button>
            </div>
          )}

          {/* ── ШАГ 2: КОНТРАГЕНТ ── */}
          {step === 'counterparty' && (
            <div>
              <input
                value={searchCP} onChange={e => setSearchCP(e.target.value)}
                placeholder="Поиск контрагента..."
                style={{
                  width: '100%', background: '#F2F3F5', border: '1.5px solid transparent',
                  borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#1A1C21',
                  outline: 'none', boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              {loadingCPs ? (
                <p style={{ color: '#9498AB', textAlign: 'center', padding: '20px 0' }}>Загрузка...</p>
              ) : filteredCPs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: 14, color: '#9498AB', marginBottom: 8 }}>Контрагентов-покупателей нет</p>
                  <p style={{ fontSize: 12, color: '#CDD0D8' }}>Добавь в разделе Контакты</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredCPs.map(cp => (
                    <button key={cp.id} onClick={() => setSelectedCP(cp)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: selectedCP?.id === cp.id ? '#EBF2FF' : '#F8F9FB',
                      outline: selectedCP?.id === cp.id ? '2px solid #1E6FEB' : '1px solid #E0E1E6',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: selectedCP?.id === cp.id ? '#1E6FEB' : '#E0E1E6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700,
                        color: selectedCP?.id === cp.id ? 'white' : '#9498AB',
                      }}>
                        {cp.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>{cp.name}</p>
                        {cp.company && <p style={{ fontSize: 11, color: '#9498AB' }}>{cp.company}</p>}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                        background: '#F2F3F5', color: '#9498AB',
                      }}>
                        {cp.type === 'buyer' ? 'покупатель' : 'оба'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ШАГ 3: ПОДТВЕРЖДЕНИЕ ── */}
          {step === 'confirm' && selectedCP && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#F8F9FB', borderRadius: 12, padding: '14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Товар</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>{listing.title}</p>
                {selectedSerial && (
                  <p style={{ fontSize: 12, color: '#5A5E72', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                    {selectedSerial.serial_number ? `S/N: ${selectedSerial.serial_number}` : `IMEI: ${selectedSerial.imei}`}
                  </p>
                )}
              </div>

              <div style={{ background: '#F8F9FB', borderRadius: 12, padding: '14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Покупатель</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>{selectedCP.name}</p>
                {selectedCP.company && <p style={{ fontSize: 12, color: '#9498AB' }}>{selectedCP.company}</p>}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Итоговая цена</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" value={price} onChange={e => setPrice(e.target.value)}
                    style={{
                      flex: 1, background: '#F2F3F5', border: '1.5px solid #1E6FEB',
                      borderRadius: 12, padding: '12px 14px', fontSize: 20,
                      fontWeight: 800, color: '#1A1C21', outline: 'none',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>₽</span>
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#E8251F', background: '#FFEBEA', borderRadius: 10, padding: '10px 12px' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #F2F3F5', display: 'flex', gap: 10 }}>
          {step !== 'serial' && (
            <button onClick={() => setStep(step === 'confirm' ? 'counterparty' : 'serial')} style={{
              padding: '13px 20px', borderRadius: 12, border: '1.5px solid #E0E1E6',
              background: 'white', color: '#1A1C21', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              ← Назад
            </button>
          )}

          {step === 'serial' && (
            <button
              onClick={() => setStep('counterparty')}
              disabled={!selectedSerial && !noSerial}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: (selectedSerial || noSerial) ? '#1E6FEB' : '#E0E1E6',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
              Далее →
            </button>
          )}

          {step === 'counterparty' && (
            <button
              onClick={() => setStep('confirm')}
              disabled={!selectedCP}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: selectedCP ? '#1E6FEB' : '#E0E1E6',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
              Далее →
            </button>
          )}

          {step === 'confirm' && (
            <button
              onClick={completeDeal}
              disabled={saving || !price || Number(price) <= 0}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: saving ? '#9498AB' : '#00B173',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
              {saving ? 'Сохраняем...' : '✅ Провести сделку'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
