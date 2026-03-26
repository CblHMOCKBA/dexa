'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import BackButton from '@/components/ui/BackButton'

type Offer = {
  id: string
  request_id: string
  seller_id: string
  price: number
  comment: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  seller: {
    id: string; name: string; location: string | null
    rating: number; deals_count: number; is_verified: boolean
  } | null
}

type Request = {
  id: string; buyer_id: string; title: string; budget_max: number
  status: 'open' | 'closed' | 'expired'
}

export default function RequestOffersClient({
  request, offers, currentUserId
}: {
  request: Request
  offers: Offer[]
  currentUserId: string
}) {
  const router = useRouter()
  const isOwn  = request.buyer_id === currentUserId
  const [acting, setActing] = useState<string | null>(null)

  async function acceptOffer(offer: Offer) {
    setActing(offer.id)
    const supabase = createClient()

    // Принимаем этот оффер
    await supabase.from('request_offers').update({ status: 'accepted' }).eq('id', offer.id)

    // Отклоняем остальные
    await supabase.from('request_offers')
      .update({ status: 'rejected' })
      .eq('request_id', request.id)
      .neq('id', offer.id)

    // Закрываем запрос
    await supabase.from('requests').update({ status: 'closed' }).eq('id', request.id)

    // Открываем чат с продавцом
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: null,
        seller_id: offer.seller_id,
        request_id: request.id,
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const chatData = await res.json().catch(() => ({}))

    setActing(null)
    router.refresh()
    router.push('/feed?tab=requests')
  }

  async function rejectOffer(offerId: string) {
    setActing(offerId)
    const supabase = createClient()
    await supabase.from('request_offers').update({ status: 'rejected' }).eq('id', offerId)
    setActing(null)
    router.refresh()
  }

  const pending  = offers.filter(o => o.status === 'pending')
  const accepted = offers.find(o => o.status === 'accepted')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/feed" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>Офферы</h1>
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>{request.title}</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
          background: request.status === 'open' ? '#E6F9F3' : '#F2F3F5',
          color: request.status === 'open' ? '#006644' : '#9498AB',
        }}>
          {request.status === 'open' ? 'Открыт' : request.status === 'closed' ? 'Закрыт' : 'Истёк'}
        </span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

        {offers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⏳</p>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Офферов пока нет</p>
            <p style={{ fontSize: 14, color: '#9498AB' }}>Продавцы увидят запрос в ленте</p>
          </div>
        )}

        {accepted && (
          <div style={{ background: '#E6F9F3', borderRadius: 14, padding: '12px 14px', border: '1.5px solid #00B173' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#006644', marginBottom: 8 }}>✓ ПРИНЯТЫЙ ОФФЕР</p>
            <OfferRow offer={accepted} isOwn={isOwn} acting={acting}
              onAccept={acceptOffer} onReject={rejectOffer} />
          </div>
        )}

        {pending.length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {pending.length} {pending.length === 1 ? 'оффер' : 'офферов'} · от дешёвого к дорогому
            </p>
            {pending.map((offer, i) => (
              <div key={offer.id} style={{
                background: 'white', borderRadius: 14, padding: '12px 14px',
                border: i === 0 ? '1.5px solid #1E6FEB' : '1.5px solid #E0E1E6',
                position: 'relative',
              }}>
                {i === 0 && (
                  <span style={{
                    position: 'absolute', top: -10, left: 14,
                    fontSize: 10, fontWeight: 700, background: '#1E6FEB', color: 'white',
                    padding: '2px 10px', borderRadius: 5,
                  }}>
                    ЛУЧШАЯ ЦЕНА
                  </span>
                )}
                <OfferRow offer={offer} isOwn={isOwn} acting={acting}
                  onAccept={acceptOffer} onReject={rejectOffer} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function OfferRow({ offer, isOwn, acting, onAccept, onReject }: {
  offer: Offer; isOwn: boolean; acting: string | null
  onAccept: (o: Offer) => void; onReject: (id: string) => void
}) {
  const router = useRouter()

  async function goChat() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: null, seller_id: offer.seller_id }),
    })
    const data = await res.json()
    if (data.id) router.push(`/chat/${data.id}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar name={offer.seller?.name ?? '?'} size="xs" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1C21' }}>{offer.seller?.name ?? 'Продавец'}</p>
            {offer.seller?.is_verified && <span style={{ fontSize: 10, color: '#1E6FEB' }}>✓</span>}
          </div>
          <p style={{ fontSize: 11, color: '#9498AB' }}>
            {offer.seller?.deals_count ?? 0} сделок
            {offer.seller?.location ? ` · ${offer.seller.location}` : ''}
          </p>
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#1E6FEB', fontFamily: 'var(--font-mono)' }}>
          {offer.price.toLocaleString('ru-RU')} ₽
        </p>
      </div>

      {offer.comment && (
        <p style={{ fontSize: 13, color: '#5A5E72', lineHeight: 1.5, marginBottom: 10, paddingLeft: 38 }}>
          {offer.comment}
        </p>
      )}

      {isOwn && offer.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, paddingLeft: 38 }}>
          <button onClick={() => onAccept(offer)} disabled={!!acting} style={{
            flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#1E6FEB', color: 'white', fontSize: 13, fontWeight: 700,
            opacity: acting === offer.id ? 0.7 : 1,
          }}>
            {acting === offer.id ? '...' : '✓ Принять'}
          </button>
          <button onClick={goChat} style={{
            padding: '9px 14px', borderRadius: 10, border: '1.5px solid #E0E1E6',
            background: 'white', color: '#1A1C21', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            💬
          </button>
          <button onClick={() => onReject(offer.id)} disabled={!!acting} style={{
            padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#FFEBEA', color: '#E8251F', fontSize: 13, fontWeight: 600,
            opacity: acting === offer.id ? 0.7 : 1,
          }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
