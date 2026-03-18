// ============================================================
// DEXA · Types v2
// ============================================================

// ─── Database row types ───────────────────────────────────

export type Profile = {
  id: string
  name: string
  shop_name: string | null
  location: string | null
  description: string | null
  avatar_url: string | null
  is_verified: boolean
  rating: number
  deals_count: number
  created_at: string
}

export type Listing = {
  id: string
  seller_id: string
  title: string
  brand: string | null
  model: string | null
  condition: 'new' | 'used'
  price: number
  quantity: number
  description: string | null
  photo_url: string | null
  status: 'active' | 'reserved' | 'sold'
  created_at: string
  // joined
  seller?: Profile
}

export type Chat = {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  created_at: string
  // joined
  listing?: Listing | null
  buyer?: Profile
  seller?: Profile
  last_message?: Message | null
  unread_count?: number
}

export type Message = {
  id: string
  chat_id: string
  sender_id: string
  text: string
  is_read: boolean
  created_at: string
  // joined
  sender?: Profile
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'

export type CounterStatus = 'pending' | 'accepted' | 'rejected' | null

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

// ─── Form types ───────────────────────────────────────────

export type CreateListingInput = {
  title: string
  brand?: string
  model?: string
  condition: 'new' | 'used'
  price: number
  quantity: number
  description?: string
  photo_url?: string
}

export type UpdateListingInput = Partial<CreateListingInput> & {
  status?: 'active' | 'reserved' | 'sold'
}

export type CreateOrderInput = {
  listing_id: string
  chat_id: string
  seller_id: string
  quantity: number
  total_price: number
  timer_minutes?: number
  delivery_address?: string
  courier_note?: string
}

export type UpdateProfileInput = {
  name?: string
  shop_name?: string
  location?: string
  description?: string
  avatar_url?: string
}

// ─── UI state types ───────────────────────────────────────

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

export type ListingFilter = {
  search?: string
  brand?: string
  condition?: 'new' | 'used' | 'all'
  min_price?: number
  max_price?: number
  status?: 'active' | 'all'
}

// ─── Supabase database helper type ───────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'rating' | 'deals_count' | 'created_at' | 'is_verified'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      listings: {
        Row: Listing
        Insert: Omit<Listing, 'id' | 'status' | 'created_at' | 'seller'>
        Update: Partial<Omit<Listing, 'id' | 'seller_id' | 'created_at' | 'seller'>>
      }
      chats: {
        Row: Chat
        Insert: Omit<Chat, 'id' | 'created_at' | 'listing' | 'buyer' | 'seller' | 'last_message' | 'unread_count'>
        Update: never
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'is_read' | 'created_at' | 'sender'>
        Update: Pick<Message, 'is_read'>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'status' | 'buyer_approved' | 'seller_approved' | 'created_at' | 'listing' | 'buyer' | 'seller'>
        Update: Partial<Pick<Order,
          'status' | 'buyer_approved' | 'seller_approved' |
          'buyer_approved_at' | 'seller_approved_at' |
          'delivery_address' | 'courier_note' | 'expires_at' |
          'counter_price' | 'counter_by' | 'counter_round' | 'counter_status' |
          'total_price' | 'timer_minutes'
        >>
      }
      order_events: {
        Row: OrderEvent
        Insert: Omit<OrderEvent, 'id' | 'created_at' | 'actor'>
        Update: never
      }
    }
  }
}
