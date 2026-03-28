'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'

const PRESETS = [-10, -5, -3] as const

export default function ListingCard({ listing, index = 0, initialLiked = false, onLikeToggle, currentUserId }: {
  listing: Listing
  index?: number
  initialLiked?: boolean
  onLikeToggle?: (id: string, liked: boolean) => void
  currentUserId?: string
}) {
  const router = useRouter()

  const [liked, setLiked]         = useState(initialLiked)
  const [likeAnim, setLikeAnim]   = useState(false)
  const [toast, setToast]         = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  // ── Inline offer state ──
  const [offerOpen, setOfferOpen]     = useState(false)
  const [offerPrice, setOfferPrice]   = useState(listing.price.toString())
  const [offerLoading, setOfferLoading] = useState(false)
  const [offerError, setOfferError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOwn = !!(currentUserId && currentUserId === listing.seller_id)

  const numPrice  = Number(offerPrice)
  const listPrice = listing.price
  const diff      = numPrice - listPrice
  const diffPct   = listPrice > 0 ? Math.abs((diff / listPrice) * 100).toFixed(1) : '0'
  const isLower   = diff < 0
  const isHigher  = diff > 0

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleCardClick() {
    if (offerOpen) return   // Не навигируем пока оффер открыт
    router.push(`/listing/${listing.id}`)
  }

  function toggleOffer(e: React.MouseEvent) {
    e.stopPropagation()
    if (isOwn) { showToast('Это ваше объявление'); return }
    const next = !offerOpen
    setOfferOpen(next)
    setOfferError(null)
    if (next) {
      setOfferPrice(listing.price.toString())
      // Фокус на инпут после анимации
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }

  function setPreset(pct: number, e: React.MouseEvent) {
    e.stopPropagation()
    const p = Math.round(listPrice * (1 + pct / 100))
    setOfferPrice(p.toString())
    setOfferError(null)
  }

  function setFull(e: React.MouseEvent) {
    e.stopPropagation()
    setOfferPrice(listPrice.toString())
    setOfferError(null)
  }

  async function sendOffer(e: React.MouseEvent) {
    e.stopPropagation()
    if (!numPrice || numPrice <= 0 || offerLoading) return
    setOfferLoading(true); setOfferError(null)
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
        setOfferError(data.error === 'Own listing' ? 'Это ваш товар' : (data.error ?? 'Ошибка'))
        setOfferLoading(false)
        return
      }
      setOfferOpen(false)
      router.push(`/chat/${data.chat_id}`)
    } catch {
      setOfferError('Ошибка сети')
      setOfferLoading(false)
    }
  }

  async function goChat(e: React.MouseEvent) {
    e.stopPropagation()
    if (chatLoading) return
    if (isOwn) { showToast('Это ваше объявление'); return }
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, seller_id: listing.seller_id }),
      })
      const data = await res.json()
      if (!res.ok) { showToast('Ошибка. Попробуй ещё раз'); return }
      router.push(`/chat/${data.id}`)
    } catch {
      showToast('Ошибка сети')
    } finally {
      setChatLoading(false)
    }
  }

  async function toggleLike(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !liked
    setLiked(next)
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 400)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (next) {
      await supabase.from('watchlist').insert({ user_id: user.id, listing_id: listing.id, price_at_save: listing.price })
    } else {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('listing_id', listing.id)
    }
    onLikeToggle?.(listing.id, next)
  }

  const seller = listing.seller
  const name   = seller?.name ?? 'Продавец'
  const tags   = (listing as { tags?: string[] }).tags ?? []

  return (
    <div
      className="card-press press-card"
      style={{
        position: 'relative',
        animation: `fade-up 0.28s ease both ${Math.min(index * 0.05, 0.3)}s`,
        // Убираем press-эффект пока открыт оффер
        pointerEvents: 'auto',
      }}
      onClick={handleCardClick}
    >
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,28,33,0.88)', color: '#fff', borderRadius: 20,
          padding: '6px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 10, pointerEvents: 'none',
          animation: 'pop-in 0.2s var(--spring-bounce) both',
        }}>{toast}</div>
      )}

      <div style={{ padding: '14px 14px 12px' }}>

        {/* Верхняя строка: продавец + лайк */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={name} size="xs" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </p>
              {seller?.is_verified && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
            </div>
            {seller?.location && (
              <p style={{ fontSize: 11, color: '#9498AB' }}>{seller.location}</p>
            )}
          </div>

          {/* Цена + лайк */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800, color: '#1A1C21' }}>
              {listing.price.toLocaleString('ru-RU')} ₽
            </p>
            <button onClick={toggleLike} style={{
              width: 34, height: 34, borderRadius: 10,
              background: liked ? '#FFEBEA' : '#F2F3F5',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: likeAnim ? 'scale(1.35)' : 'scale(1)',
              transition: 'transform 0.2s var(--spring-bounce), background 0.15s',
              flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill={liked ? '#E8251F' : 'none'}
                stroke={liked ? '#E8251F' : '#9498AB'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Название */}
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', lineHeight: 1.3, marginBottom: 10 }}>
          {listing.title}
        </p>

        {/* Теги */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
            background: listing.condition === 'new' ? '#E6F9F3' : '#FFF4E0',
            color: listing.condition === 'new' ? '#006644' : '#7A4F00',
          }}>
            {listing.condition === 'new' ? '✨ Новый' : '🔄 Б/У'}
          </span>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
              background: '#F2F3F5', color: '#5A5E72',
            }}>
              {tag}
            </span>
          ))}
          {listing.quantity > 1 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
              background: '#EBF2FF', color: '#1249A8',
            }}>
              × {listing.quantity} шт
            </span>
          )}
        </div>

        {/* Кнопки */}
        {!isOwn ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={goChat} disabled={chatLoading} style={{
              flex: 1, height: 38, borderRadius: 10, border: 'none',
              cursor: chatLoading ? 'not-allowed' : 'pointer',
              background: chatLoading ? '#E0E1E6' : '#2AABEE',
              color: 'white', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" strokeWidth="0">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              {chatLoading ? '...' : 'Написать'}
            </button>

            {/* Кнопка оффер — меняется когда открыт */}
            <button onClick={toggleOffer} style={{
              height: 38, borderRadius: 10,
              border: offerOpen ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
              background: offerOpen ? '#EBF2FF' : '#F8F9FB',
              color: offerOpen ? '#1E6FEB' : '#1A1C21',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '0 14px',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              <span style={{
                display: 'inline-block',
                transform: offerOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                fontSize: 16, lineHeight: 1,
              }}>
                {offerOpen ? '✕' : '💬'}
              </span>
              {offerOpen ? 'Закрыть' : 'Оффер'}
            </button>
          </div>
        ) : (
          <div style={{
            height: 38, borderRadius: 10, background: '#F2F3F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: '#9498AB',
          }}>
            Ваш товар
          </div>
        )}
      </div>

      {/* ── Inline Offer Panel (аккордеон) ── */}
      <div style={{
        maxHeight: offerOpen ? '320px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            margin: '0 12px 12px',
            background: '#F8F9FB',
            borderRadius: 14,
            padding: '14px',
            border: '1.5px solid #E8EAEF',
          }}
        >
          {/* Строка: цена продавца → твоя цена со стрелкой */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Цена продавца
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#9498AB', textDecoration: 'line-through' }}>
                {listPrice.toLocaleString('ru-RU')} ₽
              </p>
            </div>

            {/* Индикатор разницы */}
            <div style={{
              padding: '4px 10px', borderRadius: 8,
              background: numPrice > 0 && isLower ? '#E6F9F3' : numPrice > 0 && isHigher ? '#FFEBEA' : '#F2F3F5',
              transition: 'background 0.2s',
            }}>
              <p style={{
                fontSize: 12, fontWeight: 700,
                color: numPrice > 0 && isLower ? '#006644' : numPrice > 0 && isHigher ? '#C0392B' : '#9498AB',
                fontFamily: 'var(--font-mono)',
              }}>
                {numPrice > 0 && isLower ? `−${diffPct}%` :
                 numPrice > 0 && isHigher ? `+${diffPct}%` : '='}
              </p>
            </div>

            <div style={{ flex: 1, textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Ваш оффер
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#1A1C21' }}>
                {numPrice > 0 ? numPrice.toLocaleString('ru-RU') + ' ₽' : '—'}
              </p>
            </div>
          </div>

          {/* Инпут цены */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input
              ref={inputRef}
              type="number"
              value={offerPrice}
              onChange={e => { setOfferPrice(e.target.value); setOfferError(null) }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#fff',
                border: `1.5px solid ${numPrice > 0 && isLower ? '#00B173' : numPrice > 0 && isHigher ? '#E8251F' : '#E0E1E6'}`,
                borderRadius: 10, padding: '10px 40px 10px 14px',
                fontSize: 18, fontWeight: 800, color: '#1A1C21',
                outline: 'none', fontFamily: 'var(--font-mono)',
                transition: 'border-color 0.2s',
              }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, fontWeight: 700, color: '#9498AB', pointerEvents: 'none',
            }}>₽</span>
          </div>

          {/* Пресеты */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {PRESETS.map(pct => {
              const p = Math.round(listPrice * (1 + pct / 100))
              const active = numPrice === p
              return (
                <button key={pct} onClick={e => setPreset(pct, e)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8,
                  border: active ? '1.5px solid #00B173' : '1.5px solid #E0E1E6',
                  background: active ? '#E6F9F3' : '#fff',
                  color: active ? '#006644' : '#5A5E72',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {pct}%
                </button>
              )
            })}
            <button onClick={setFull} style={{
              flex: 1, padding: '6px 4px', borderRadius: 8,
              border: numPrice === listPrice ? '1.5px solid #1E6FEB' : '1.5px solid #E0E1E6',
              background: numPrice === listPrice ? '#EBF2FF' : '#fff',
              color: numPrice === listPrice ? '#1E6FEB' : '#5A5E72',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              Полная
            </button>
          </div>

          {/* Ошибка */}
          {offerError && (
            <p style={{ fontSize: 12, color: '#E8251F', background: '#FFEBEA', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
              {offerError}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={sendOffer}
            disabled={offerLoading || !numPrice || numPrice <= 0}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: offerLoading || !numPrice ? '#E0E1E6' : '#1E6FEB',
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: offerLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            {offerLoading
              ? 'Отправляем...'
              : `Предложить${numPrice > 0 ? ' ' + numPrice.toLocaleString('ru-RU') + ' ₽' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}
