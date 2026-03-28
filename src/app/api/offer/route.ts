import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/offer
// Покупатель предлагает цену прямо из ленты.
// Создаёт (или находит) чат, создаёт ордер pending, пишет системное сообщение.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listing_id, seller_id, offer_price } = await req.json()

  if (!listing_id || !seller_id || !offer_price) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (user.id === seller_id) {
    return NextResponse.json({ error: 'Own listing' }, { status: 400 })
  }
  if (Number(offer_price) <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
  }

  // 1. Найти или создать чат
  const { data: existingChat } = await supabase
    .from('chats')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .eq('seller_id', seller_id)
    .single()

  let chatId: string

  if (existingChat) {
    chatId = existingChat.id
  } else {
    const { data: newChat, error: chatErr } = await supabase
      .from('chats')
      .insert({ listing_id, buyer_id: user.id, seller_id })
      .select('id')
      .single()

    if (chatErr || !newChat) {
      return NextResponse.json({ error: chatErr?.message ?? 'Chat error' }, { status: 500 })
    }
    chatId = newChat.id
  }

  // 2. Проверяем — нет ли уже активного ордера по этому чату
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('chat_id', chatId)
    .in('status', ['pending', 'confirmed', 'in_delivery'])
    .single()

  if (existingOrder) {
    // Уже есть активный ордер — просто редиректим в чат
    return NextResponse.json({ chat_id: chatId, order_id: existingOrder.id, existed: true })
  }

  // 3. Создаём ордер со статусом pending
  // counter_price = offer_price (покупатель предлагает цену отличную от listing.price)
  const { data: listing } = await supabase
    .from('listings')
    .select('price, title')
    .eq('id', listing_id)
    .single()

  const listingPrice = listing?.price ?? Number(offer_price)

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      listing_id,
      chat_id:        chatId,
      buyer_id:       user.id,
      seller_id,
      quantity:       1,
      total_price:    listingPrice,   // оригинальная цена листинга
      status:         'pending',
      timer_minutes:  30,
      // Оффер покупателя — сразу как counter_price
      counter_price:  Number(offer_price),
      counter_by:     user.id,
      counter_round:  1,
      counter_status: 'pending',
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message ?? 'Order error' }, { status: 500 })
  }

  // 4. Системное сообщение в чат — формат совпадает с ChatWindowClient.decodeSystemMsg
  // SYSTEM:ORDER_CREATED:{orderId}:{price}:{title}
  const priceFormatted = Number(offer_price).toLocaleString('ru-RU')
  const listingTitle   = listing?.title ?? 'Товар'
  await supabase.from('messages').insert({
    chat_id:   chatId,
    sender_id: user.id,
    text:      `SYSTEM:ORDER_CREATED:${order.id}:${priceFormatted}:${listingTitle}`,
  })

  // 5. Событие в ленту активности ордера
  await supabase.from('order_events').insert({
    order_id:   order.id,
    actor_id:   user.id,
    event_type: 'counter_sent',
    payload:    { price: Number(offer_price), round: 1 },
  })

  return NextResponse.json({ chat_id: chatId, order_id: order.id })
}
