'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import LockedFeature from '@/components/ui/LockedFeature'

export default function ProfileClient({ profile, listings, isOwner }: {
  profile: Profile; listings: Listing[]; isOwner: boolean
}) {
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Профиль</h1>
          {isOwner && (
            <button onClick={logout} style={{
              background: '#FFEBEA', color: '#E8251F', border: 'none',
              borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', minHeight: 36,
            }}>
              Выйти
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* Hero карточка */}
        <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <Avatar name={profile.name} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1C21' }}>{profile.name}</h2>
                {profile.is_verified && (
                  <span className="badge badge-verified">✓ верифицирован</span>
                )}
              </div>
              {profile.shop_name && (
                <p style={{ fontSize: 14, color: '#5A5E72', marginBottom: 4 }}>{profile.shop_name}</p>
              )}
              {profile.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <p style={{ fontSize: 13, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {profile.location}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Статы */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#F0F1F4', borderRadius: 12, overflow: 'hidden' }}>
            {[
              { val: profile.deals_count,                               label: 'Сделок' },
              { val: profile.rating > 0 ? profile.rating.toFixed(1) : '—', label: 'Рейтинг' },
              { val: listings.length,                                   label: 'Товаров' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', padding: '12px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#1A1C21' }}>{s.val}</p>
                <p style={{ fontSize: 11, color: '#9498AB', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Верификация */}
        {!profile.is_verified && (
          <div style={{ marginBottom: 16 }}>
            <LockedFeature label="Верификация продавца" version="v1.0">
              <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>Верификация продавца</p>
                  <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>Бейдж доверия · приоритет в ленте</p>
                </div>
              </div>
            </LockedFeature>
          </div>
        )}

        {/* Мои товары */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="section-label">Мои товары</p>
          <button onClick={() => router.push('/warehouse')}
            style={{ fontSize: 13, color: '#1E6FEB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
            Управление →
          </button>
        </div>

        {listings.length === 0 ? (
          <p style={{ color: '#9498AB', fontSize: 14 }}>Нет товаров</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {listings.map((l, i) => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i < listings.length - 1 ? '1px solid #F0F1F4' : 'none',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="1.5">
                    <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.title}
                  </p>
                  <p style={{ fontSize: 12, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {l.quantity} шт · {l.price.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0,
                  color: l.status === 'active' ? '#006644' : l.status === 'reserved' ? '#7A4F00' : '#9498AB',
                }}>
                  {l.status === 'active' ? '● Активен' : l.status === 'reserved' ? '◐ Бронь' : '○ Продан'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
