import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import ListingForm from '@/components/warehouse/ListingForm'
import type { ListingTemplate } from '@/types'

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const { template: templateId } = await searchParams
  let template: ListingTemplate | undefined

  if (templateId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('listing_templates')
      .select('*')
      .eq('id', templateId)
      .single()
    template = data ?? undefined
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/warehouse" />
        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', flex: 1 }}>
          {template ? `Из шаблона: ${template.name}` : 'Новый товар'}
        </h1>
      </div>
      <ListingForm template={template} />
    </div>
  )
}
