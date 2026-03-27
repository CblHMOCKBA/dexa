'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import StarRating from '@/components/ui/StarRating'
import PriceChart from './PriceChart'

type PricePoint = {
  total_price: number
  counter_price: number | null
  counter_status: string | null
  created_at: string
  quantity: number
}

type Props = {
  listing: Listing
  priceHistory: PricePoint[]
  similar: Listing[]
  currentUserId: string
}

export default function ListingDetail({ listing, priceHistory, similar, currentUserId }: Props) {
  const router = useRouter()
  const [chatLoading, setChatLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const seller   = listing.seller
  const isOwner  = currentUserId === listing.seller_id
  const isSold   = listing.status !== 'active'

  // Финальные цены сделок для графика
  const chartData = priceHistory.map(p => ({
    price: p.counter_status === 'accepted' && p.counter_price ? p.counter_price : p.total_price,
    date:  new Date(p.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  }))

  const avgPrice = chartData.length > 0
    ? Math.round(chartData.reduce((s, p) => s + p.price, 0) / chartData.length)
    : null

  const priceDiff = avgPrice ? Math.round(((listing.price - avgPrice) / avgPrice) * 100) : null

  async function goChat() {
    if (isOwner || chatLoading) return
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, seller_id: listing.seller_id }),
      })
      const data = await res.json()
      if (!res.ok || !data.id) return
      router.push(`/chat/${data.id}`)
    } catch {
      // silent fail
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Главный блок: цена + статус ── */}
      <div style={{ background: '#fff', padding: '20px 16px', borderBottom: '1px solid #F0F1F4' }}>

        {/* Бейджи */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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

        <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', lineHeight: 1.3, marginBottom: 14 }}>
          {listing.title}
        </p>

        {/* Цена — крупно как на бирже */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: '#1A1C21', lineHeight: 1 }}>
            {listing.price.toLocaleString('ru-RU')} ₽
          </p>
          {priceDiff !== null && (
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: priceDiff > 0 ? '#E8251F' : '#00B173',
            }}>
              {priceDiff > 0 ? '+' : ''}{priceDiff}% к рынку
            </span>
          )}
        </div>

        {/* Средняя цена рынка */}
        {avgPrice && (
          <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 14 }}>
            Средняя по {priceHistory.length} сделкам:{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#5A5E72' }}>
              {avgPrice.toLocaleString('ru-RU')} ₽
            </span>
          </p>
        )}

        {/* Статус */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: listing.status === 'active' ? '#00B173' : listing.status === 'reserved' ? '#F5A623' : '#CDD0D8',
          }}/>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: listing.status === 'active' ? '#006644' : listing.status === 'reserved' ? '#7A4F00' : '#9498AB',
          }}>
            {listing.status === 'active' ? 'В наличии' : listing.status === 'reserved' ? 'Забронировано' : 'Продано'}
          </span>
        </div>
      </div>

      {/* ── График цен ── */}
      {chartData.length > 0 && (
        <div style={{ background: '#fff', marginTop: 10, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21' }}>История цен сделок</p>
            <span style={{ fontSize: 12, color: '#9498AB' }}>{chartData.length} сделок</span>
          </div>
          <PriceChart data={chartData} />
        </div>
      )}

      {/* ── Продавец ── */}
      <div style={{ background: '#fff', marginTop: 10, padding: '16px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
          Продавец
        </p>
        <Link href={`/profile/${listing.seller_id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F2F3F5', borderRadius: 12 }}>
            <Avatar name={seller?.name ?? 'П'} size="md" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21' }}>{seller?.name}</p>
                {seller?.is_verified && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                )}
              </div>
              {seller && seller.rating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <StarRating value={seller.rating} size={12} />
                  <span style={{ fontSize: 11, color: '#9498AB' }}>
                    {seller.rating.toFixed(1)} · {seller.deals_count} сделок
                  </span>
                </div>
              )}
              {seller?.location && (
                <p style={{ fontSize: 12, color: '#9498AB', marginTop: 2 }}>{seller.location}</p>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CDD0D8" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </Link>
      </div>

      {/* ── Описание ── */}
      {listing.description && (
        <div style={{ background: '#fff', marginTop: 10, padding: '16px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Описание
          </p>
          <p style={{ fontSize: 14, color: '#5A5E72', lineHeight: 1.6 }}>{listing.description}</p>
        </div>
      )}

      {/* ── Похожие предложения ── */}
      {similar.length > 0 && (
        <div style={{ background: '#fff', marginTop: 10, padding: '16px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Другие предложения
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid #F0F1F4' }}>
            {similar.map((s, i) => (
              <Link key={s.id} href={`/listing/${s.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: '#fff', borderBottom: i < similar.length - 1 ? '1px solid #F0F1F4' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.seller?.name ?? 'Продавец'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>
                      {s.quantity} шт · {s.condition === 'new' ? 'Новый' : 'Б/У'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>
                      {s.price.toLocaleString('ru-RU')} ₽
                    </p>
                    {avgPrice && (
                      <p style={{ fontSize: 11, fontWeight: 600, color: s.price < avgPrice ? '#00B173' : '#E8251F' }}>
                        {s.price < avgPrice ? '↓ дешевле' : '↑ дороже'}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA встроена в страницу ── */}
      <div style={{ background: '#fff', marginTop: 10, padding: '16px' }}>
        {isOwner ? (
          <Link href={`/warehouse/${listing.id}/edit`} style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%', padding: '15px', borderRadius: 14,
              border: '1.5px solid #1E6FEB', background: '#EBF2FF',
              color: '#1E6FEB', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              ✏️ Редактировать объявление
            </button>
          </Link>
        ) : isSold ? (
          <div style={{ padding: '15px', borderRadius: 14, background: '#F2F3F5', textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#9498AB' }}>
            Товар недоступен
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/profile/${listing.seller_id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, border: '1.5px solid #E0E1E6', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Avatar name={seller?.name ?? 'П'} size="xs" />
              </div>
            </Link>
            <button onClick={goChat} disabled={chatLoading} style={{
              flex: 1, padding: '15px', borderRadius: 14,
              background: chatLoading ? '#9498AB' : '#1E6FEB',
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: chatLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}>
              {chatLoading ? 'Открываем...' : '💬 Написать · Купить'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
