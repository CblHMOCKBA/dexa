import { createClient } from '@/lib/supabase/server'
import SignPage from '@/components/documents/SignPage'

export default async function SignDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  // Используем service role для публичного доступа к документу по коду
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('documents')
    .select(`
      *,
      owner:profiles!documents_owner_id_fkey(name, shop_name, location),
      order:orders(total_price, listing:listings(title)),
      items:document_items(*, serial_item:serial_items(serial_number, imei))
    `)
    .eq('sign_code', code)
    .single()

  if (!doc) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>❌</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1C21', marginBottom: 8 }}>
            Документ не найден
          </p>
          <p style={{ fontSize: 14, color: '#9498AB' }}>
            Ссылка недействительна или документ был удалён
          </p>
        </div>
      </div>
    )
  }

  return <SignPage signCode={code} document={doc} />
}
