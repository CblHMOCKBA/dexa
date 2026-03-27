'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Listing, Review } from '@/types'
import Avatar from '@/components/ui/Avatar'
import StarRating from '@/components/ui/StarRating'
import ReviewCard from './ReviewCard'

type Props = { profile: Profile; listings: Listing[]; reviews: Review[] }

export default function OwnProfile({ profile, listings, reviews }: Props) {
  const router = useRouter()
  const [editing, setEditing]   = useState(false)
  const [editTab, setEditTab]   = useState<'profile' | 'requisites'>('profile')
  const [name, setName]         = useState(profile.name)
  const [shopName, setShop]     = useState(profile.shop_name ?? '')
  const [location, setLoc]      = useState(profile.location ?? '')
  const [bio, setBio]           = useState(profile.bio ?? '')
  // Реквизиты для документов
  const [companyName, setCompany] = useState((profile as { company_name?: string }).company_name ?? '')
  const [inn, setInn]             = useState((profile as { inn?: string }).inn ?? '')
  const [legalAddr, setLegal]     = useState((profile as { legal_address?: string }).legal_address ?? '')
  const [bankDetails, setBank]    = useState((profile as { bank_details?: string }).bank_details ?? '')
  const [saving, setSaving]       = useState(false)
  const [tab, setTab]             = useState<'listings' | 'reviews'>('listings')
  const [showQR, setShowQR]       = useState(false)



  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function saveProfile() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      name:          name.trim(),
      shop_name:     shopName.trim() || null,
      location:      location.trim() || null,
      bio:           bio.trim() || null,
      company_name:  companyName.trim() || null,
      inn:           inn.trim() || null,
      legal_address: legalAddr.trim() || null,
      bank_details:  bankDetails.trim() || null,
    }).eq('id', profile.id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  const activeListings = listings.filter(l => l.status === 'active')
  const hasRequisites  = companyName || inn || legalAddr

  return (
    <div style={{ paddingBottom: 'calc(32px + var(--sab))' }}>
      <div style={{ background: '#fff', padding: '20px 16px 0' }}>

        {/* Шапка */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <Avatar name={profile.name} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21', flex: 1, minWidth: 0 }}>{profile.name}</h1>
              <button onClick={logout} style={{
                flexShrink: 0, padding: '5px 11px', borderRadius: 8, border: 'none',
                background: '#FFEBEA', color: '#E8251F', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Выйти</button>
              {profile.is_verified && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFF8E0', borderRadius: 8, padding: '3px 8px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5E00' }}>верифицирован</span>
                </div>
              )}
            </div>
            {profile.shop_name && <p style={{ fontSize: 14, color: '#5A5E72', marginBottom: 2 }}>{profile.shop_name}</p>}
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

        {profile.bio && !editing && (
          <p style={{ fontSize: 14, color: '#5A5E72', lineHeight: 1.6, marginBottom: 14 }}>{profile.bio}</p>
        )}

        {/* Статы */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#F0F1F4', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
          {[
            { val: profile.deals_count, label: 'Сделок' },
            { val: profile.rating > 0 ? profile.rating.toFixed(1) : '—', label: 'Рейтинг' },
            { val: activeListings.length, label: 'Товаров' },
            { val: (profile as { followers_count?: number }).followers_count ?? 0, label: 'Подписчиков' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', padding: '11px 6px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#1A1C21' }}>{s.val}</p>
              <p style={{ fontSize: 10, color: '#9498AB', marginTop: 1 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Реквизиты — предупреждение если не заполнены */}
        {!hasRequisites && !editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF4E0', border: '1.5px solid #F5A623', borderRadius: 12, padding: '10px 14px', marginBottom: 14, cursor: 'pointer' }}
            onClick={() => { setEditing(true); setEditTab('requisites') }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#7A4F00' }}>Заполни реквизиты</p>
              <p style={{ fontSize: 11, color: '#9A6800' }}>Нужны для формирования накладных</p>
            </div>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8, paddingBottom: 0 }}>
          <button onClick={() => setEditing(p => !p)} style={{
            padding: '11px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            border: '1.5px solid #E0E1E6', background: '#fff', color: '#1A1C21',
            cursor: 'pointer', textAlign: 'center',
          }}>
            {editing ? '✕ Отмена' : '✏️ Изменить'}
          </button>
          <button onClick={() => setShowQR(true)} style={{
            padding: '11px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            border: 'none', background: '#1E6FEB', color: '#fff',
            cursor: 'pointer', textAlign: 'center',
          }}>
            📲 QR-визитка
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, paddingBottom: 14 }}>
          <Link href="/analytics" style={{
            padding: '11px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#EBF2FF', color: '#1249A8', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            📊 Аналитика
          </Link>
          <Link href="/roadmap" style={{
            padding: '11px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#1A1C21', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            🗺 Roadmap
          </Link>
        </div>

        {/* Форма редактирования */}
        {editing && (
          <div style={{ borderTop: '1px solid #F0F1F4', paddingTop: 14, paddingBottom: 16 }}>
            {/* Мини-табы */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['profile','requisites'] as const).map(t => (
                <button key={t} onClick={() => setEditTab(t)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: editTab === t ? '#1E6FEB' : '#F2F3F5',
                  color: editTab === t ? '#fff' : '#5A5E72',
                }}>
                  {t === 'profile' ? 'Профиль' : '📋 Реквизиты'}
                </button>
              ))}
            </div>

            {editTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Имя', val: name, set: setName, ph: '' },
                  { label: 'Название точки', val: shopName, set: setShop, ph: 'Павильон B-12' },
                  { label: 'Локация', val: location, set: setLoc, ph: 'Горбушка B-12' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="input" />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase' }}>О себе</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="input" style={{ resize: 'none' }} />
                </div>
              </div>
            )}

            {editTab === 'requisites' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: '#9498AB', lineHeight: 1.5 }}>
                  Используются при формировании накладных и актов
                </p>
                {[
                  { label: 'Название ИП/компании', val: companyName, set: setCompany, ph: 'ИП Иванов Иван Иванович' },
                  { label: 'ИНН', val: inn, set: setInn, ph: '123456789012' },
                  { label: 'Юридический адрес', val: legalAddr, set: setLegal, ph: 'г. Москва, ул. Горбушка...' },
                  { label: 'Банковские реквизиты', val: bankDetails, set: setBank, ph: 'Тинькофф, р/с 40817...' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="input" />
                  </div>
                ))}
              </div>
            )}

            <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ marginTop: 14 }}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        )}

        {/* Быстрые ссылки */}
        {!editing && (
          <div style={{ display: 'flex', gap: 8, paddingBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/warehouse">
              <button style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📦 Склад
              </button>
            </Link>
            <Link href="/orders">
              <button style={{ background: '#E6F9F3', color: '#006644', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🤝 Сделки
              </button>
            </Link>
            <Link href="/documents">
              <button style={{ background: '#F0E8FF', color: '#5B00CC', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📄 Документы
              </button>
            </Link>
            <button disabled style={{ background: '#F2F3F5', color: '#9498AB', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'not-allowed', opacity: 0.65, display: 'flex', alignItems: 'center', gap: 6 }}>
              👥 Мои продавцы
              <span style={{ background: '#1E6FEB', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 5, lineHeight: 1 }}>v1.0</span>
            </button>
          </div>
        )}

        {/* Табы */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F4', marginLeft: -16, marginRight: -16, paddingLeft: 16 }}>
          {(['listings', 'reviews'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#1E6FEB' : '#9498AB',
              borderBottom: tab === t ? '2px solid #1E6FEB' : '2px solid transparent', marginBottom: -1,
            }}>
              {t === 'listings' ? `Товары · ${activeListings.length}` : `Отзывы · ${reviews.length}`}
            </button>
          ))}
        </div>
      </div>

      {/* Товары */}
      {tab === 'listings' && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: '#9498AB', marginBottom: 12 }}>Нет активных товаров</p>
              <Link href="/warehouse/new">
                <button style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  + Добавить товар
                </button>
              </Link>
            </div>
          ) : activeListings.map(l => (
            <div key={l.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#9498AB', marginTop: 2 }}>{l.quantity} шт · {l.price.toLocaleString('ru-RU')} ₽</p>
              </div>
              <Link href={`/warehouse/${l.id}/edit`}>
                <button style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E0E1E6', background: '#fff', fontSize: 12, color: '#5A5E72', cursor: 'pointer' }}>
                  Изменить
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Отзывы */}
      {tab === 'reviews' && (
        <div style={{ background: '#fff', padding: '0 16px' }}>
          {reviews.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9498AB', padding: '40px 0', fontSize: 14 }}>Нет отзывов</p>
          ) : (
            <>
              {profile.rating > 0 && (
                <div style={{ padding: '16px 0', borderBottom: '1px solid #F0F1F4', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, color: '#1A1C21' }}>{profile.rating.toFixed(1)}</p>
                  <div>
                    <StarRating value={profile.rating} size={20} />
                    <p style={{ fontSize: 12, color: '#9498AB', marginTop: 4 }}>{reviews.length} отзывов</p>
                  </div>
                </div>
              )}
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </>
          )}
        </div>
      )}
    </div>
      {/* QR-визитка */}
      {showQR && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => setShowQR(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 24, padding: '28px 24px',
            width: '100%', maxWidth: 340, textAlign: 'center',
            animation: 'pop-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {/* Заголовок */}
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1C21', marginBottom: 4 }}>
              {profile.name}
            </p>
            {profile.shop_name && (
              <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 4 }}>{profile.shop_name}</p>
            )}
            {profile.location && (
              <p style={{ fontSize: 13, color: '#1E6FEB', fontWeight: 600, marginBottom: 16 }}>
                📍 {profile.location}
              </p>
            )}

            {/* QR код — Google Charts API, работает везде */}
            <div style={{
              display: 'inline-flex', padding: 12, borderRadius: 16,
              background: '#F8F9FF', border: '1px solid #E0E1E6',
              marginBottom: 16,
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://dexa-ten.vercel.app')}/profile/${profile.id}&format=png&margin=1`}
                alt="QR-визитка"
                width={240}
                height={240}
                style={{ display: 'block', borderRadius: 8 }}
              />
            </div>

            {/* Подпись */}
            <p style={{ fontSize: 12, color: '#9498AB', marginBottom: 20, lineHeight: 1.5 }}>
              Покажи этот QR покупателю — он увидит твои товары и контакты в Dexa
            </p>

            {/* Кнопки */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowQR(false)} style={{
                padding: '12px', borderRadius: 12, border: '1.5px solid #E0E1E6',
                background: '#fff', fontSize: 14, fontWeight: 600, color: '#5A5E72', cursor: 'pointer',
              }}>Закрыть</button>
              <button onClick={() => {
                const url = `${window.location.origin}/profile/${profile.id}`
                navigator.clipboard?.writeText(url).then(() => {
                  alert('Ссылка скопирована!')
                }).catch(() => {})
              }} style={{
                padding: '12px', borderRadius: 12, border: 'none',
                background: '#1E6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>🔗 Копировать</button>
            </div>
          </div>
        </div>
      )}
  )
}
