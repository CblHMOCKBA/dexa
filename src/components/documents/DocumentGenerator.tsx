'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'

type Props = {
  order: Order & {
    listing?: { title: string; brand?: string }
    seller?: { name: string }
    buyer?:  { name: string }
  }
  currentUserId: string
  existingDocId?: string
  existingDocUrl?: string
  existingDocNumber?: string
}

export default function DocumentGenerator({
  order, currentUserId, existingDocId, existingDocUrl, existingDocNumber,
}: Props) {
  const router = useRouter()
  const [loading, setLoading]     = useState(false)
  const [docUrl, setDocUrl]       = useState(existingDocUrl ?? null)
  const [docNumber, setDocNumber] = useState(existingDocNumber ?? null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)

  const isSeller = currentUserId === order.seller_id

  // Только продавец может создавать документы
  if (!isSeller || order.status !== 'completed') return null

  async function generate() {
    setLoading(true); setError(null)

    const supabase = createClient()

    // 1. Создаём запись документа в БД
    const { data: numData } = await supabase
      .rpc('next_doc_number', { p_owner_id: currentUserId })

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        owner_id:       currentUserId,
        order_id:       order.id,
        type:           'invoice',
        number:         numData as string,
        status:         'draft',
      })
      .select('id, number, sign_code')
      .single()

    if (docErr || !doc) {
      setError('Ошибка создания документа')
      setLoading(false)
      return
    }

    // 2. Добавляем позицию (товар из ордера)
    await supabase.from('document_items').insert({
      document_id: doc.id,
      title:       order.listing?.title ?? 'Товар',
      quantity:    order.quantity,
      price:       order.counter_status === 'accepted' && order.counter_price
                     ? order.counter_price
                     : order.total_price,
    })

    // 3. Вызываем Edge Function для генерации PDF
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ document_id: doc.id }),
      }
    )

    const result = await res.json()

    if (!res.ok || result.error) {
      setError('Ошибка генерации. Попробуй ещё раз.')
      setLoading(false)
      return
    }

    setDocUrl(result.url)
    setDocNumber(result.number)
    setLoading(false)
    router.refresh()
  }

  async function copySignLink() {
    if (!docUrl) return
    // Извлекаем sign_code из документа
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('sign_code')
      .eq('order_id', order.id)
      .eq('owner_id', currentUserId)
      .single()

    if (data?.sign_code) {
      const url = `${window.location.origin}/sign/${data.sign_code}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <p style={{
        fontSize: 12, fontWeight: 700, color: '#9498AB',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
      }}>
        📄 Документы
      </p>

      {!docUrl ? (
        <div>
          <p style={{ fontSize: 14, color: '#5A5E72', marginBottom: 12, lineHeight: 1.5 }}>
            Сформируй накладную по этой сделке — с S/N, продавцом, покупателем и суммой.
          </p>
          <button onClick={generate} disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                  style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeDasharray="30" strokeDashoffset="10"/>
                </svg>
                Генерируем...
              </span>
            ) : '📄 Сформировать накладную'}
          </button>
          {error && <p style={{ color: '#E8251F', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Номер документа */}
          <div style={{ background: '#E6F9F3', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00B173" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#006644' }}>
              Накладная {docNumber}
            </p>
          </div>

          {/* Открыть/скачать */}
          <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: '#1E6FEB', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Открыть накладную
            </button>
          </a>

          {/* Ссылка для подписания */}
          <button onClick={copySignLink} style={{
            width: '100%', padding: '11px', borderRadius: 12,
            background: copied ? '#E6F9F3' : '#F2F3F5',
            color: copied ? '#006644' : '#5A5E72',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}>
            {copied ? (
              <>✓ Ссылка скопирована</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Скопировать ссылку для подписания
              </>
            )}
          </button>

          <p style={{ fontSize: 11, color: '#9498AB', textAlign: 'center' }}>
            Покупатель откроет ссылку и подтвердит получение
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
