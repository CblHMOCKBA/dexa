'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Listing, Review } from '@/types'
import Avatar from '@/components/ui/Avatar'
import StarRating from '@/components/ui/StarRating'
import ReviewCard from './ReviewCard'

type Props = {
  profile: Profile
  listings: Listing[]
  reviews: Review[]
  isFollowing: boolean
  isOwner: boolean
  currentUserId: string
}

export default function PublicProfile({
  profile, listings, reviews, isFollowing: initFollow, isOwner, currentUserId,
}: Props) {
  const router = useRouter()
  const [following, setFollowing] = useState(initFollow)
  const [followLoading, setFollowLoading] = useState(false)
  const [tab, setTab] = useState<'listings' | 'reviews'>('listings')

  async function toggleFollow() {
    if (isOwner || followLoading) return
    setFollowLoading(true)
    const supabase = createClient()
    if (following) {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
    } else {
      await supabase.from('follows')
        .insert({ follower_id: currentUserId, following_id: profile.id })
    }
    setFollowing(p => !p)
    setFollowLoading(false)
    router.refresh()
  }

  async function startChat() {
    router.push(`/feed`)
  }

  const activeListings = listings.filter(l => l.status === 'active')

  return (
    <div style={{ paddingBottom: 'calc(32px + var(--sab))' }}>

      {/* Hero */}
      <div style={{ background: '#fff', padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <Avatar name={profile.name} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>{profile.name}</h1>
              {profile.is_verified && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFF8E0', borderRadius: 8, padding: '3px 8px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5E00' }}>верифицирован</span>
                </div>
              )}
            </div>
            {profile.shop_name && (
              <p style={{ fontSize: 14, color: '#5A5E72', marginBottom: 2 }}>{profile.shop_name}</p>
            )}
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <p style={{ fontSize: 13, color: '#1E6FEB', fontWeight: 600 }}>{profile.location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p style={{ fontSize: 14, color: '#5A5E72', lineHeight: 1.6, marginBottom: 16 }}>
            {profile.bio}
          </p>
        )}

        {/* Статы */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#F0F1F4', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          {[
            { val: profile.deals_count,        label: 'Сделок' },
            { val: profile.rating > 0 ? profile.rating.toFixed(1) : '—', label: 'Рейтинг' },
            { val: activeListings.length,       label: 'Товаров' },
            { val: profile.followers_count,     label: 'Подписчиков' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                {s.label === 'Рейтинг' && profile.rating > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#F0B90B" stroke="#F0B90B" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                )}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#1A1C21' }}>{s.val}</p>
              </div>
              <p style={{ fontSize: 10, color: '#9498AB' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Кнопки действий */}
        {!isOwner && (
          <div style={{ display: 'flex', gap: 10, paddingBottom: 16 }}>
            <button onClick={toggleFollow} disabled={followLoading} style={{
              flex: 1, padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              border: following ? '1.5px solid #E0E1E6' : 'none',
              background: following ? '#fff' : '#1E6FEB',
              color: following ? '#1A1C21' : '#fff',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {followLoading ? '...' : following ? '✓ Подписан' : '+ Подписаться'}
            </button>
            <Link href="/chat" style={{ flex: 1 }}>
              <button style={{
                width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                border: '1.5px solid #E0E1E6', background: '#fff', color: '#1A1C21',
                cursor: 'pointer',
              }}>
                Написать
              </button>
            </Link>
          </div>
        )}

        {/* Табы */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F4', marginLeft: -16, marginRight: -16, paddingLeft: 16 }}>
          {(['listings', 'reviews'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#1E6FEB' : '#9498AB',
              borderBottom: tab === t ? '2px solid #1E6FEB' : '2px solid transparent',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}>
              {t === 'listings'
                ? `Товары${activeListings.length > 0 ? ` · ${activeListings.length}` : ''}`
                : `Отзывы${reviews.length > 0 ? ` · ${reviews.length}` : ''}`
              }
            </button>
          ))}
        </div>
      </div>

      {/* Товары */}
      {tab === 'listings' && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeListings.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9498AB', padding: '40px 0', fontSize: 14 }}>
              Нет активных товаров
            </p>
          ) : activeListings.map(l => (
            <div key={l.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', lineHeight: 1.3 }}>{l.title}</p>
                  {l.model && <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>{l.model}</p>}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1A1C21', flexShrink: 0 }}>
                  {l.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`badge badge-${l.condition === 'new' ? 'new' : 'used'}`}>
                  {l.condition === 'new' ? 'Новый' : 'Б/У'}
                </span>
                {l.brand && (
                  <span style={{ fontSize: 11, color: '#9498AB', background: '#F2F3F5', borderRadius: 5, padding: '2px 7px' }}>
                    {l.brand}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#9498AB' }}>{l.quantity} шт</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00B173', display: 'block' }}/>
                  <span style={{ fontSize: 11, color: '#006644', fontWeight: 600 }}>В наличии</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Отзывы */}
      {tab === 'reviews' && (
        <div style={{ background: '#fff', padding: '0 16px' }}>
          {reviews.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9498AB', padding: '40px 0', fontSize: 14 }}>
              Нет отзывов
            </p>
          ) : (
            <>
              {/* Общий рейтинг */}
              {profile.rating > 0 && (
                <div style={{ padding: '16px 0', borderBottom: '1px solid #F0F1F4', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, color: '#1A1C21' }}>
                    {profile.rating.toFixed(1)}
                  </p>
                  <div>
                    <StarRating value={profile.rating} size={20} />
                    <p style={{ fontSize: 12, color: '#9498AB', marginTop: 4 }}>
                      {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}
                    </p>
                  </div>
                </div>
              )}
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
