'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import StarRating from '@/components/ui/StarRating'

export default function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const router = useRouter()
  const [liked, setLiked]           = useState(false)
  const [likeAnim, setLikeAnim]     = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Тап на карточку → страница товара
  function handleCardClick() {
    router.push(`/listing/${listing.id}`)
  }

  async function goChat(e: React.MouseEvent) {
    // Не даём открыться /listing/[id] при клике на кнопку
    e.stopPropagation()
    if (chatLoading) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (user.id === listing.seller_id) { showToast('Это ваш товар'); return }

    setChatLoading(true)
    const { data: ex } = await supabase.from('chats').select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', listing.seller_id)
      .single()

    if (ex) { router.push(`/chat/${ex.id}`); return }

    const { data: nc, error } = await supabase.from('chats')
      .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id })
      .select('id').single()

    setChatLoading(false)
    if (error) { showToast('Ошибка. Попробуй ещё раз'); return }
    if (nc) router.push(`/chat/${nc.id}`)
  }

  function toggleLike(e: React.MouseEvent) {
    e.stopPropagation()
    setLiked(p => !p)
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 400)
  }

  const seller = listing.seller
  const name   = seller?.name ?? 'Продавец'

  return (
    <div
      className="card-press anim-card"
      style={{ padding: 16, animationDelay: `${index * 45}ms`, position: 'relative', cursor: 'pointer' }}
      onClick={handleCardClick}
    >
      {/* Тост */}
      {toast && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1C21', color: '#fff', borderRadius: 20,
          padding: '6px 14px', fontSize: 13, fontWeight: 500,
          zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fade-up 0.2s ease both',
        }}>
          {toast}
        </div>
      )}

      {/* Название + цена + лайк */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: '#1A1C21' }}>
            {listing.title}
          </p>
          {listing.model && (
            <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>{listing.model}</p>
          )}
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
            transform: likeAnim ? 'scale(1.3)' : 'scale(1)',
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

      {/* Теги */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className={`badge badge-${listing.condition === 'new' ? 'new' : 'used'}`}>
          {listing.condition === 'new' ? 'Новый' : 'Б/У'}
        </span>
        {listing.brand && (
          <span className="badge" style={{ background: '#F2F3F5', color: '#5A5E72' }}>
            {listing.brand}
          </span>
        )}
        <span className="badge" style={{ background: '#F2F3F5', color: '#5A5E72' }}>
          {listing.quantity} шт
        </span>
      </div>

      <div style={{ height: 1, background: '#F0F1F4', marginBottom: 12 }}/>

      {/* Продавец + кнопка */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>

        {/* Ссылка на профиль — stopPropagation чтобы не открывался /listing/[id] */}
        <div
          onClick={e => { e.stopPropagation(); router.push(`/profile/${listing.seller_id}`) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={name} size="xs" />
            <span style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 9, height: 9, borderRadius: '50%',
              background: '#00B173', border: '2px solid #fff',
            }}/>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </p>
              {seller?.is_verified && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
            </div>
            {seller && seller.rating > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <StarRating value={seller.rating} size={10} />
                <span style={{ fontSize: 10, color: '#9498AB' }}>
                  {seller.rating.toFixed(1)} · {seller.deals_count} сд.
                </span>
              </div>
            ) : seller?.location ? (
              <p style={{ fontSize: 11, color: '#9498AB' }}>{seller.location}</p>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Статус */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: listing.status === 'active' ? '#00B173' : listing.status === 'reserved' ? '#F5A623' : '#CDD0D8',
            }}/>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: listing.status === 'active' ? '#006644' : listing.status === 'reserved' ? '#7A4F00' : '#9498AB',
            }}>
              {listing.status === 'active' ? 'В наличии' : listing.status === 'reserved' ? 'Бронь' : 'Продано'}
            </span>
          </div>

          {listing.status === 'active' && (
            <button onClick={goChat} disabled={chatLoading} style={{
              background: chatLoading ? '#E0E1E6' : '#1E6FEB',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '7px 14px', fontSize: 13, fontWeight: 700,
              cursor: chatLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.14s', minWidth: 80,
            }}>
              {chatLoading ? '...' : 'Написать'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
