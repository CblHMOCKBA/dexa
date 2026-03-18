import type { Review } from '@/types'
import StarRating from '@/components/ui/StarRating'
import Avatar from '@/components/ui/Avatar'

export default function ReviewCard({ review }: { review: Review }) {
  const name = review.reviewer?.name ?? 'Покупатель'
  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid #F0F1F4',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar name={name} size="xs" />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1C21' }}>{name}</p>
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>
            {new Date(review.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <StarRating value={review.rating} size={14} />
      </div>
      {review.comment && (
        <p style={{ fontSize: 14, color: '#5A5E72', lineHeight: 1.55, paddingLeft: 40 }}>
          {review.comment}
        </p>
      )}
    </div>
  )
}
