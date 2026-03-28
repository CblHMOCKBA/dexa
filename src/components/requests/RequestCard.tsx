'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'

export type RequestItem = {
  id: string
  buyer_id: string
  title: string
  brand: string | null
  model: string | null
  condition: 'new' | 'used' | 'any'
  quantity: number
  budget_min: number | null
  budget_max: number
  description: string | null
  status: 'open' | 'closed' | 'expired'
  expires_at: string
  created_at: string
  buyer: { name: string; location: string | null; avatar_url: string | null } | null
  offers_count?: number
}

type Props = {
  request: RequestItem
  currentUserId: string
  myOffer?: { id: string; price: number; status: string } | null
}

function daysLeft(expiresAt: string) {
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  if (d <= 0) return 'истёк'
  if (d === 1) return '1 день'
  if (d < 5)  return `${d} дня`
  return `${d} дней`
}

export default function RequestCard({ request, currentUserId, myOffer }: Props) {
  const router = useRouter()
  const [showOffer, setShowOffer]       = useState(false)
  const [price, setPrice]               = useState(myOffer?.price?.toString() ?? '')
  const [comment, setComment]           = useState('')
  const [sending, setSending]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [deleted, setDeleted]           = useState(false)

  const isOwn  = request.buyer_id === currentUserId
  const isOpen = request.status === 'open'
  const left   = daysLeft(request.expires_at)

  async function sendOffer() {
    if (!price || Number(price) <= 0) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('request_offers').insert({
      request_id: request.id,
      seller_id:  currentUserId,
      price:      Number(price),
      comment:    comment.trim() || null,
    })
    setSending(false)
    if (!error) { setShowOffer(false); router.refresh() }
  }

  async function deleteRequest() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('request_offers').delete().eq('request_id', request.id)
    await supabase.from('requests').delete().eq('id', request.id)
    setDeleted(true)
    setDeleting(false)
    router.refresh()
  }

  const condLabel = { new: '✨ Новый', used: '🔄 Б/У', any: 'Любое' }[request.condition]

  // Анимация исчезновения после удаления
  if (deleted) return null

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: `1.5px solid ${confirmDelete ? '#FFCDD0' : '#E8F0FF'}`,
      overflow: 'hidden',
      animation: 'pop-in 0.25s var(--spring-bounce) both',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{
        background: confirmDelete
          ? 'linear-gradient(135deg, #FFEBEA 0%, #FFF2F2 100%)'
          : 'linear-gradient(135deg, #EBF2FF 0%, #F0F4FF 100%)',
        padding: '12px 14px 10px',
        borderBottom: `1px solid ${confirmDelete ? '#FFCDD0' : '#E0EAFF'}`,
        transition: 'background 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Avatar name={request.buyer?.name ?? '?'} size="xs" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1E6FEB', background: '#fff', padding: '1px 7px', borderRadius: 5 }}>
                📢 ЗАПРОС
              </span>
              <span style={{ fontSize: 11, color: '#9498AB' }}>
                {request.buyer?.name ?? 'Покупатель'}
              </span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', lineHeight: 1.3, margin: 0 }}>
              {request.title}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: left === 'истёк' ? '#E8251F' : '#9498AB', fontWeight: 600 }}>
              ⏱ {left}
            </p>
            {(request.offers_count ?? 0) > 0 && (
              <p style={{ fontSize: 11, color: '#1E6FEB', fontWeight: 700 }}>
                {request.offers_count} офферов
              </p>
            )}
            {/* Кнопка удаления — только для владельца */}
            {isOwn && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} style={{
                width: 26, height: 26, borderRadius: 8, border: 'none',
                background: 'rgba(232,37,31,0.08)', color: '#E8251F',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, transition: 'background 0.15s',
              }}>
                🗑
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {request.brand && (
            <span style={{ fontSize: 11, fontWeight: 600, background: '#F2F3F5', color: '#5A5E72', padding: '3px 9px', borderRadius: 6 }}>
              {request.brand}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, background: '#F2F3F5', color: '#5A5E72', padding: '3px 9px', borderRadius: 6 }}>
            {condLabel}
          </span>
          {request.quantity > 1 && (
            <span style={{ fontSize: 11, fontWeight: 600, background: '#FFF4E0', color: '#7A4F00', padding: '3px 9px', borderRadius: 6 }}>
              × {request.quantity} шт
            </span>
          )}
        </div>

        <div style={{ marginBottom: request.description ? 8 : 0 }}>
          <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 1 }}>Бюджет</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#1A1C21', fontFamily: 'var(--font-mono)' }}>
            {request.budget_min
              ? `${request.budget_min.toLocaleString('ru-RU')} — ${request.budget_max.toLocaleString('ru-RU')} ₽`
              : `до ${request.budget_max.toLocaleString('ru-RU')} ₽`
            }
          </p>
        </div>

        {request.description && (
          <p style={{ fontSize: 13, color: '#5A5E72', lineHeight: 1.5, marginBottom: 0 }}>
            {request.description}
          </p>
        )}
      </div>

      {/* Подтверждение удаления */}
      {isOwn && confirmDelete && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ background: '#FFEBEA', borderRadius: 12, padding: '12px 14px', border: '1px solid #FFCDD0' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#A8170F', marginBottom: 10, textAlign: 'center' }}>
              Удалить этот запрос?
            </p>
            <p style={{ fontSize: 11, color: '#9498AB', textAlign: 'center', marginBottom: 12 }}>
              Все офферы от продавцов тоже удалятся
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #E0E1E6',
                background: 'white', color: '#1A1C21', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Отмена
              </button>
              <button onClick={deleteRequest} disabled={deleting} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: '#E8251F', color: 'white', fontSize: 13, fontWeight: 700,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
              }}>
                {deleting ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions для чужих */}
      {!isOwn && isOpen && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myOffer ? (
            <div style={{
              background: '#E6F9F3', borderRadius: 10, padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 11, color: '#006644', fontWeight: 700 }}>✓ Ваш оффер отправлен</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', fontFamily: 'var(--font-mono)' }}>
                  {myOffer.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                background: myOffer.status === 'accepted' ? '#E6F9F3' : myOffer.status === 'rejected' ? '#FFEBEA' : '#F2F3F5',
                color: myOffer.status === 'accepted' ? '#006644' : myOffer.status === 'rejected' ? '#E8251F' : '#9498AB',
              }}>
                {myOffer.status === 'accepted' ? 'Принят' : myOffer.status === 'rejected' ? 'Отклонён' : 'На рассмотрении'}
              </span>
            </div>
          ) : showOffer ? (
            <div style={{ background: '#F8F9FF', borderRadius: 12, padding: 12, border: '1.5px solid #E0E8FF' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1249A8', marginBottom: 10 }}>Ваше предложение</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="Ваша цена ₽" min={1}
                  style={{ flex: 1, background: 'white', border: '1.5px solid #1E6FEB', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 700, color: '#1A1C21', outline: 'none', fontFamily: 'var(--font-mono)' }}
                />
                <button onClick={sendOffer} disabled={sending || !price} style={{
                  padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: !price ? '#E0E1E6' : '#1E6FEB', color: 'white',
                  fontSize: 14, fontWeight: 700, flexShrink: 0, opacity: sending ? 0.7 : 1,
                }}>
                  {sending ? '...' : 'Отправить'}
                </button>
              </div>
              <input value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Комментарий (опционально)"
                style={{ width: '100%', background: 'white', border: '1.5px solid #E0E1E6', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#1A1C21', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => setShowOffer(false)} style={{ marginTop: 8, fontSize: 12, color: '#9498AB', background: 'none', border: 'none', cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          ) : (
            <button onClick={() => setShowOffer(true)} style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#1E6FEB', color: 'white', fontSize: 14, fontWeight: 700,
            }}>
              💰 Предложить цену
            </button>
          )}
        </div>
      )}

      {/* Кнопки владельца */}
      {isOwn && !confirmDelete && (
        <div style={{ padding: '0 14px 14px' }}>
          <button onClick={() => router.push(`/requests/${request.id}`)} style={{
            width: '100%', padding: '11px', borderRadius: 12, border: '1.5px solid #E0E1E6',
            background: 'white', color: '#1A1C21', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Смотреть офферы ({request.offers_count ?? 0}) →
          </button>
        </div>
      )}
    </div>
  )
}
