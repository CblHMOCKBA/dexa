// DEXA · Patch 016 · Добавь в конец src/types/index.ts

export type CounterpartyType = 'supplier' | 'buyer' | 'both' | 'courier'
export type PaymentDirection  = 'in' | 'out'
export type PaymentMethod     = 'cash' | 'transfer' | 'crypto' | 'other'

export type Counterparty = {
  id: string
  owner_id: string
  name: string
  company: string | null
  phone: string | null
  inn: string | null
  type: CounterpartyType
  credit_limit: number
  discount_pct: number
  payment_delay_days: number
  tags: string[]
  notes: string | null
  dexa_profile_id: string | null
  created_at: string
  // joined
  dexa_profile?: Profile | null
  // computed
  balance?: number
  deals_count?: number
}

export type Payment = {
  id: string
  counterparty_id: string
  owner_id: string
  amount: number
  direction: PaymentDirection
  method: PaymentMethod
  order_id: string | null
  note: string | null
  created_at: string
}
