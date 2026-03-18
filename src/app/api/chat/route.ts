import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/chat — создать или найти существующий чат
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listing_id, seller_id } = await req.json()
  if (!listing_id || !seller_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (user.id === seller_id) {
    return NextResponse.json({ error: 'Own listing' }, { status: 400 })
  }

  // Ищем существующий чат
  const { data: existing } = await supabase
    .from('chats')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .eq('seller_id', seller_id)
    .single()

  if (existing) return NextResponse.json({ id: existing.id })

  // Создаём новый
  const { data, error } = await supabase
    .from('chats')
    .insert({ listing_id, buyer_id: user.id, seller_id })
    .select('id')
    .single()

  if (error) {
    console.error('Chat create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
