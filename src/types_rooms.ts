// DEXA · Patch 009 · Добавь в конец src/types/index.ts

export type RoomRole = 'owner' | 'admin' | 'member'

export type Room = {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  owner_id: string
  is_private: boolean
  invite_code: string
  max_members: number
  created_at: string
  // joined
  member_count?: number
  my_role?: RoomRole
  last_message?: RoomMessage | null
}

export type RoomMember = {
  room_id: string
  user_id: string
  role: RoomRole
  joined_at: string
  invited_by: string | null
  // joined
  profile?: Profile
}

export type InviteLink = {
  id: string
  room_id: string
  code: string
  created_by: string
  uses_left: number | null
  expires_at: string | null
  is_active: boolean
  used_count: number
  created_at: string
}

export type RoomMessage = {
  id: string
  room_id: string
  sender_id: string
  text: string
  reply_to: string | null
  is_edited: boolean
  created_at: string
  // joined
  sender?: Profile
}
