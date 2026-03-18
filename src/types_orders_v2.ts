// DEXA · Patch 007 · Дополнения к types/index.ts
// Добавь эти типы в src/types/index.ts

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'

export type CounterStatus = 'pending' | 'accepted' | 'rejected' | null

// Обновлённый Order — замени старый в types/index.ts
export type Order = {
  id: string
  listing_id: string | null
  chat_id: string | null
  buyer_id: string
  seller_id: string
  quantity: number
  total_price: number
  status: OrderStatus
  delivery_address: string | null
  courier_note: string | null
  buyer_approved: boolean
  seller_approved: boolean
  buyer_approved_at: string | null
  seller_approved_at: string | null
  expires_at: string | null
  // v2: торг
  counter_price: number | null
  counter_by: string | null
  counter_round: number
  counter_status: CounterStatus
  timer_minutes: number
  created_at: string
  // joined
  listing?: Listing | null
  buyer?: Profile
  seller?: Profile
}

export type OrderEventType =
  | 'created'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'delivery_started'
  | 'counter_sent'
  | 'counter_accepted'
  | 'counter_rejected'
  | 'approved'
  | 'timer_expired'

export type OrderEvent = {
  id: string
  order_id: string
  actor_id: string | null
  event_type: OrderEventType
  payload: Record<string, unknown> | null
  created_at: string
  actor?: Profile
}
