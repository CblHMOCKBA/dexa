import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listing_id, counterparty_id, serial_item_id, price } = await req.json()

  if (!listing_id || !counterparty_id || !price) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Получаем данные листинга
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, quantity, seller_id')
    .eq('id', listing_id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.seller_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 })

  // Создаём ордер — buyer_id = seller_id = user.id для ручной сделки
  // counterparty_id хранит ссылку на контрагента
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    listing_id,
    chat_id:            null,
    buyer_id:           user.id,   // ручная сделка — оба участника = продавец
    seller_id:          user.id,
    quantity:           1,
    total_price:        Number(price),
    status:             'completed',
    counterparty_id:    counterparty_id,
    timer_minutes:      0,
    buyer_approved_at:  new Date().toISOString(),
    seller_approved_at: new Date().toISOString(),
  }).select('id').single()

  if (orderErr) {
    console.error('Order error:', orderErr)
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  // Обновляем серийник
  if (serial_item_id) {
    await supabase.from('serial_items').update({
      status:   'sold',
      order_id: order.id,
    }).eq('id', serial_item_id)
  }

  // Уменьшаем количество, при 0 — архивируем
  const newQty = Math.max(0, (listing.quantity ?? 1) - 1)
  await supabase.from('listings')
    .update({
      quantity: newQty,
      status: newQty === 0 ? 'sold' : 'active',
    })
    .eq('id', listing_id)

  // Фиксируем платёж у контрагента
  await supabase.from('payments').insert({
    counterparty_id,
    owner_id:  user.id,
    amount:    Number(price),
    direction: 'in',
    method:    'cash',
    order_id:  order.id,
    note:      `Продажа: ${listing.title}`,
  })

  return NextResponse.json({ id: order.id })
}
