// DEXA · Patch 012 · Добавь в конец src/types/index.ts

// Обновлённый Profile — замени существующий
export type Profile = {
  id: string
  name: string
  shop_name: string | null
  location: string | null
  description: string | null
  bio: string | null           // новое
  username: string | null      // новое — для /u/[username]
  avatar_url: string | null
  is_verified: boolean
  rating: number
  deals_count: number
  followers_count: number      // новое
  created_at: string
}

export type Review = {
  id: string
  order_id: string
  reviewer_id: string
  seller_id: string
  rating: number               // 1–5
  comment: string | null
  created_at: string
  // joined
  reviewer?: Profile
}

export type Follow = {
  follower_id: string
  following_id: string
  created_at: string
}
