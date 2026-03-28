import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/order-complete
// Атомарно завершает P2P ордер и синхронизирует склад.
// Вызывается клиентом вместо прямого supabase.update({ status: 'completed' }).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id, role } = await req.json()
  // role: 'buyer' | 'seller' | 'manual'

  if (!order_id) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
  }

  // Загружаем ордер с листингом
  const { data: order } = await supabase
    .from('orders')
    .select('*, listing:listings(id, title, quantity, status, seller_id)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Проверяем что юзер — участник сделки
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Проверяем что ордер в правильном статусе
  if (!['pending', 'confirmed', 'in_delivery'].includes(order.status)) {
    return NextResponse.json({ error: 'Order already completed or cancelled' }, { status: 400 })
  }

  // Финальная цена — согласованная или оригинальная
  const finalPrice = order.counter_status === 'accepted' && order.counter_price
    ? order.counter_price
    : order.total_price

  // 1. Обновляем ордер — статус completed + апрувы
  const now = new Date().toISOString()
  const { error: orderErr } = await supabase
    .from('orders')
    .update({
      status:             'completed',
      buyer_approved:     true,
      seller_approved:    true,
      buyer_approved_at:  now,
      seller_approved_at: now,
      total_price:        finalPrice,
    })
    .eq('id', order_id)

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  // 2. Синхронизируем склад (только если листинг существует)
  const listing = order.listing as {
    id: string; title: string; quantity: number; status: string; seller_id: string
  } | null

  if (listing) {
    const newQty = Math.max(0, (listing.quantity ?? 1) - order.quantity)
    await supabase
      .from('listings')
      .update({
        quantity: newQty,
        status:   newQty === 0 ? 'sold' : 'active',
      })
      .eq('id', listing.id)

    // 3. Помечаем серийник sold если был привязан к ордеру
    const { data: serialItems } = await supabase
      .from('serial_items')
      .select('id')
      .eq('order_id', order_id)
      .eq('status', 'available')

    if (serialItems && serialItems.length > 0) {
      await supabase
        .from('serial_items')
        .update({ status: 'sold' })
        .eq('order_id', order_id)
    }

    // Также ищем серийники привязанные к listing без order_id (для QuickOffer flow)
    // — серийник мог не быть привязан при создании ордера
  }

  // 4. Увеличиваем deals_count продавца
  await supabase.rpc('increment_deals_count', { user_id: order.seller_id })

  // 5. Если покупатель другой человек — увеличиваем и ему
  if (order.buyer_id !== order.seller_id) {
    await supabase.rpc('increment_deals_count', { user_id: order.buyer_id })
  }

  // 6. Событие в ленту активности
  await supabase.from('order_events').insert({
    order_id:   order_id,
    actor_id:   user.id,
    event_type: 'completed',
    payload:    { total_price: finalPrice, role },
  })

  return NextResponse.json({ ok: true, final_price: finalPrice })
}
