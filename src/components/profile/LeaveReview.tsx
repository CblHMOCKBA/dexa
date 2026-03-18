'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/components/ui/StarRating'
import type { Order } from '@/types'

export default function LeaveReview({
  order,
  currentUserId,
  alreadyReviewed,
}: {
  order: Order
  currentUserId: string
  alreadyReviewed: boolean
}) {
  const router = useRouter()
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(alreadyReviewed)

  // Только покупатель оставляет отзыв продавцу
  if (currentUserId !== order.buyer_id) return null
  if (order.status !== 'completed') return null

  if (done) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#E6F9F3', borderRadius: 12, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#006644' }}>
          Отзыв оставлен
        </p>
      </div>
    )
  }

  async function submit() {
    if (!rating) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('reviews').insert({
      order_id:    order.id,
      reviewer_id: currentUserId,
      seller_id:   order.seller_id,
      rating,
      comment:     comment.trim() || null,
    })
    setSaving(false)
    setDone(true)
    router.refresh()
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        Оцените сделку
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <StarRating value={rating} size={28} interactive onChange={setRating} />
        {rating > 0 && (
          <p style={{ fontSize: 14, color: '#1A1C21', fontWeight: 600 }}>
            {rating === 5 ? 'Отлично' : rating === 4 ? 'Хорошо' : rating === 3 ? 'Нормально' : rating === 2 ? 'Плохо' : 'Ужасно'}
          </p>
        )}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        rows={2}
        className="input"
        style={{ resize: 'none', marginBottom: 12 }}
      />

      <button
        onClick={submit}
        disabled={!rating || saving}
        className="btn-primary"
        style={{ width: '100%' }}
      >
        {saving ? 'Отправляем...' : 'Отправить отзыв'}
      </button>
    </div>
  )
}
