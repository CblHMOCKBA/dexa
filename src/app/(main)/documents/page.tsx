import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: docs } = await supabase
    .from('documents')
    .select('*, order:orders(id, listing:listings(title))')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
    draft:  { label: 'Черновик', color: '#9498AB', bg: '#F2F3F5' },
    sent:   { label: 'Отправлен', color: '#1249A8', bg: '#EBF2FF' },
    signed: { label: 'Подписан',  color: '#006644', bg: '#E6F9F3' },
  }

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      <div className="page-header pt-safe">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Мои документы</h1>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!docs || docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📄</p>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Нет документов</p>
            <p style={{ fontSize: 14, color: '#9498AB' }}>
              Накладные появятся после завершения сделок
            </p>
          </div>
        ) : docs.map(doc => {
          const st = STATUS_LABEL[doc.status] ?? STATUS_LABEL.draft
          return (
            <div key={doc.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EBF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  📄
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21' }}>{doc.number}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                  {doc.order?.listing?.title && (
                    <p style={{ fontSize: 13, color: '#5A5E72', marginBottom: 4 }}>
                      {doc.order.listing.title}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9498AB' }}>
                      {new Date(doc.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {doc.pdf_url && (
                      <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#1E6FEB', fontWeight: 600, textDecoration: 'none' }}>
                        Открыть →
                      </a>
                    )}
                    {doc.order?.id && (
                      <Link href={`/orders/${doc.order.id}`}
                        style={{ fontSize: 12, color: '#9498AB', textDecoration: 'none' }}>
                        Сделка
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
