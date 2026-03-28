'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  listing: {
    id: string
    title: string
    price: number
    seller_id: string
    seller?: { name?: string | null } | null
  }
  onClose: () => void
}

export default function QuickOfferSheet({ listing, onClose }: Props) {
  const router = useRouter()
  const [offerPrice, setOfferPrice] = useState(listing.price.toString())
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const numPrice   = Number(offerPrice)
  const listPrice  = listing.price
  const diff       = numPrice - listPrice
  const diffPct    = listPrice > 0 ? ((diff / listPrice) * 100).toFixed(1) : '0'
  const isLower    = diff < 0
  const isHigher   = diff > 0
  const isSame     = diff === 0

  async function sendOffer() {
    if (!numPrice || numPrice <= 0 || loading) return
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id:  listing.id,
          seller_id:   listing.seller_id,
          offer_price: numPrice,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'Own listing') {
          setError('Это ваш товар')
        } else {
          setError(data.error ?? 'Ошибка сервера')
        }
        setLoading(false)
        return
      }

      onClose()
      router.push(`/chat/${data.chat_id}`)
    } catch {
      setError('Ошибка сети')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 300, backdropFilter: 'blur(3px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 301, background: '#fff',
        borderRadius: '22px 22px 0 0',
        padding: '0 20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        animation: 'slide-up 0.28s var(--spring-smooth) both',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 36, height: 4, background: '#E0E1E6', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1A1C21', letterSpacing: '-0.02em' }}>
              💬 Быстрый оффер
            </p>
            <p style={{ fontSize: 13, color: '#9498AB', marginTop: 3, maxWidth: 240 }} className="truncate">
              {listing.title}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: '#F2F3F5', cursor: 'pointer', fontSize: 18, color: '#5A5E72',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        {/* Цена продавца */}
        <div style={{
          background: '#F8F9FB', borderRadius: 14, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Цена продавца
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: '#1A1C21', marginTop: 2 }}>
              {listPrice.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          {listing.seller?.name && (
            <div style={{
              background: '#EBF2FF', borderRadius: 10, padding: '6px 12px',
              fontSize: 13, fontWeight: 700, color: '#1249A8',
            }}>
              {listing.seller.name[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Ввод цены */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Ваша цена
          </p>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={offerPrice}
              onChange={e => setOfferPrice(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#F2F3F5',
                border: `2px solid ${numPrice > 0 && !isSame ? (isLower ? '#00B173' : '#E8251F') : '#E0E1E6'}`,
                borderRadius: 14, padding: '14px 56px 14px 16px',
                fontSize: 24, fontWeight: 800, color: '#1A1C21',
                outline: 'none', fontFamily: 'var(--font-mono)',
                transition: 'border-color 0.2s',
              }}
            />
            <span style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 18, fontWeight: 700, color: '#9498AB', pointerEvents: 'none',
            }}>₽</span>
          </div>

          {/* Разница с ценой продавца */}
          {numPrice > 0 && !isSame && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              padding: '6px 12px', borderRadius: 8,
              background: isLower ? '#E6F9F3' : '#FFEBEA',
              animation: 'fade-up 0.15s ease both',
            }}>
              <span style={{ fontSize: 14 }}>{isLower ? '📉' : '📈'}</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: isLower ? '#006644' : '#C0392B' }}>
                {isLower
                  ? `На ${Math.abs(diff).toLocaleString('ru-RU')} ₽ ниже (${Math.abs(Number(diffPct))}%)`
                  : `На ${diff.toLocaleString('ru-RU')} ₽ выше (+${diffPct}%)`
                }
              </p>
            </div>
          )}
        </div>

        {/* Быстрые пресеты */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[-10, -5, -3].map(pct => {
            const p = Math.round(listPrice * (1 + pct / 100))
            return (
              <button key={pct} onClick={() => setOfferPrice(p.toString())} style={{
                flex: 1, padding: '7px 4px', borderRadius: 10,
                border: '1.5px solid #E0E1E6',
                background: Number(offerPrice) === p ? '#E6F9F3' : '#F8F9FB',
                color: Number(offerPrice) === p ? '#006644' : '#5A5E72',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {pct}%
              </button>
            )
          })}
          <button onClick={() => setOfferPrice(listPrice.toString())} style={{
            flex: 1, padding: '7px 4px', borderRadius: 10,
            border: '1.5px solid #E0E1E6',
            background: Number(offerPrice) === listPrice ? '#EBF2FF' : '#F8F9FB',
            color: Number(offerPrice) === listPrice ? '#1E6FEB' : '#5A5E72',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            Полная
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#E8251F', background: '#FFEBEA', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={sendOffer}
          disabled={loading || !numPrice || numPrice <= 0}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: loading || !numPrice ? '#E0E1E6' : '#1E6FEB',
            color: 'white', fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            letterSpacing: '-0.01em',
          }}
        >
          {loading ? 'Отправляем...' : `Предложить ${numPrice > 0 ? numPrice.toLocaleString('ru-RU') + ' ₽' : ''}`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#CDD0D8', marginTop: 10 }}>
          Продавец получит ваш оффер и сможет принять, торговаться или отклонить
        </p>
      </div>
    </>
  )
}
