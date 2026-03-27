'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'

export default function ListingCard({ listing, index = 0, initialLiked = false, onLikeToggle }: {
  listing: Listing
  index?: number
  initialLiked?: boolean
  onLikeToggle?: (id: string, liked: boolean) => void
}) {
  const router = useRouter()
  const [liked, setLiked]           = useState(initialLiked)
  const [likeAnim, setLikeAnim]     = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleCardClick() { router.push(`/listing/${listing.id}`) }

  async function goChat(e: React.MouseEvent) {
    e.stopPropagation()
    if (chatLoading) return
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, seller_id: listing.seller_id }),
      })
      const data = await res.json()
      if (res.status === 400 && data.error === 'Own listing') {
        showToast('Это ваше объявление')
        return
      }
      if (!res.ok || !data.id) { showToast('Ошибка. Попробуй ещё раз'); return }
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
      style={{ position: 'relative', animation: `fade-up 0.28s ease both ${Math.min(index * 0.05, 0.3)}s` }}
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

        {/* Кнопка написать */}
        <button onClick={goChat} disabled={chatLoading} style={{
          width: '100%', height: 38, borderRadius: 10, border: 'none',
          cursor: chatLoading ? 'not-allowed' : 'pointer',
          background: chatLoading ? '#E0E1E6' : '#2AABEE',
          color: 'white', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'opacity 0.15s, background 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {chatLoading ? '...' : 'Написать'}
        </button>
      </div>
    </div>
  )
}
