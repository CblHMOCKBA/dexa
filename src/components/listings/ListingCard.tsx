'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import StarRating from '@/components/ui/StarRating'

export default function ListingCard({ listing, index = 0, initialLiked = false }: {
  listing: Listing
  index?: number
  initialLiked?: boolean
}) {
  const router = useRouter()
  const [liked, setLiked]           = useState(initialLiked)
  const [likeAnim, setLikeAnim]     = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [myUserId, setMyUserId]     = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function handleCardClick() { router.push(`/listing/${listing.id}`) }

  async function goChat(e: React.MouseEvent) {
    e.stopPropagation()
    if (chatLoading) return
    if (myUserId && myUserId === listing.seller_id) { showToast('Это ваше объявление'); return }
    if (myUserId && myUserId === listing.seller_id) { showToast('Это ваше объявление'); return }
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, seller_id: listing.seller_id }),
      })
      const data = await res.json()
      if (res.status === 400 && data.error === 'Own listing') { showToast('Это ваш товар'); return }
      if (!res.ok || !data.id) { showToast('Ошибка создания чата'); return }
      router.push(`/chat/${data.id}`)
    } catch { showToast('Ошибка сети') }
    finally { setChatLoading(false) }
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
      await supabase.from('watchlist').insert({
        user_id: user.id,
        listing_id: listing.id,
        price_at_save: listing.price,
      })
      showToast('❤️ Добавлено в избранное')
    } else {
      await supabase.from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listing.id)
      showToast('Убрано из избранного')
    }
  }

  const seller = listing.seller
  const name   = seller?.name ?? 'Продавец'
  const animStyle = { animation: `stagger-fade 0.3s ease both ${Math.min(index * 0.04, 0.3)}s` }

  return (
    <div className="card-press press-card" style={{ position: 'relative', ...animStyle }} onClick={handleCardClick}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,28,33,0.88)', color: '#fff', borderRadius: 20,
          padding: '6px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 10, pointerEvents: 'none', backdropFilter: 'blur(6px)',
          animation: 'pop-in 0.2s var(--spring-bounce) both',
        }}>{toast}</div>
      )}

      <div style={{ padding: '14px 14px 10px' }}>
        {/* Верхняя строка: продавец + цена + лайк */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={name} size="xs" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
              {seller?.is_verified && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              )}
            </div>
            {seller?.location && <p style={{ fontSize: 11, color: '#9498AB' }}>{seller.location}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>
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
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={liked ? '#E8251F' : 'none'}
                stroke={liked ? '#E8251F' : '#9498AB'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Название */}
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', marginBottom: 8, lineHeight: 1.3 }}>
          {listing.title}
        </p>

        {/* Теги */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className={`badge badge-${listing.condition === 'new' ? 'new' : 'used'}`}>
            {listing.condition === 'new' ? 'Новый' : 'Б/У'}
          </span>
          {(listing as { tags?: string[] }).tags?.map(tag => (
            <span key={tag} className="badge badge-tag">{tag}</span>
          ))}
          {listing.quantity > 1 && (
            <span className="badge badge-qty">{listing.quantity} шт</span>
          )}
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 8 }}>
          {myUserId === listing.seller_id ? (
            <div style={{ flex: 1, height: 38, borderRadius: 10, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#9498AB' }}>
              Ваше объявление
            </div>
          ) : (
            <button onClick={goChat} disabled={chatLoading} style={{
              flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: chatLoading ? '#E0E1E6' : '#2AABEE',
              color: 'white', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'opacity 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              {chatLoading ? '...' : 'Написать'}
            </button>
          )}
          {seller && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F2F3F5', borderRadius: 10, padding: '0 12px', height: 38 }}>
              <StarRating rating={seller.rating ?? 0} size={12} />
              <span style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {seller.deals_count ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
