import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listing_id, counterparty_id, serial_item_id, price, payment_method } = await req.json()

  if (!listing_id || !counterparty_id || !price) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const validMethods = ['cash', 'transfer', 'crypto', 'other']
  const method = validMethods.includes(payment_method) ? payment_method : 'cash'

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, quantity, seller_id')
    .eq('id', listing_id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.seller_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 })

  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    listing_id,
    chat_id:            null,
    buyer_id:           user.id,
    seller_id:          user.id,
    quantity:           1,
    total_price:        Number(price),
    status:             'completed',
    counterparty_id:    counterparty_id,
    timer_minutes:      0,
    buyer_approved_at:  new Date().toISOString(),
    seller_approved_at: new Date().toISOString(),
    buyer_approved:     true,
    seller_approved:    true,
  }).select('id').single()

  if (orderErr) {
    console.error('Order error:', orderErr)
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  if (serial_item_id) {
    await supabase.from('serial_items').update({
      status:   'sold',
      order_id: order.id,
    }).eq('id', serial_item_id)
  }

  const newQty = Math.max(0, (listing.quantity ?? 1) - 1)
  await supabase.from('listings')
    .update({
      quantity: newQty,
      status: newQty === 0 ? 'sold' : 'active',
    })
    .eq('id', listing_id)

  await supabase.from('payments').insert({
    counterparty_id,
    owner_id:  user.id,
    amount:    Number(price),
    direction: 'in',
    method,
    order_id:  order.id,
    note:      `Продажа: ${listing.title}`,
  })

  await supabase.rpc('increment_deals_count', { user_id: user.id })

  // Записываем событие в ленту активности
  await supabase.from('order_events').insert({
    order_id:   order.id,
    actor_id:   user.id,
    event_type: 'completed',
    payload:    { total_price: Number(price), method },
  })

  return NextResponse.json({ id: order.id })
}
