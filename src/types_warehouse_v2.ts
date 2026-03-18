// DEXA · Patch 008 · Дополнения к src/types/index.ts
// Найди тип Listing и замени его на этот.
// Добавь тип ListingTemplate в конец файла.

// ── Замени существующий тип Listing ──────────────────────
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
  // v2: умный склад
  cost_price: number | null   // закупочная цена — только для владельца
  min_stock: number           // порог алерта остатков
  tags: string[]              // пользовательские теги
  expires_at: string | null   // авто-снятие
  template_id: string | null  // из какого шаблона создан
  created_at: string
  // joined
  seller?: Profile
}

// ── Добавь в конец файла ──────────────────────────────────
export type ListingTemplate = {
  id: string
  seller_id: string
  name: string
  data: Partial<Listing>   // снапшот полей
  created_at: string
}

export type WarehouseFilter = {
  search: string
  status: 'all' | 'active' | 'reserved' | 'sold'
  lowStock: boolean
  selected: Set<string>   // для массовых операций
}
