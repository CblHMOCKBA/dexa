import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/room — создать групповую комнату
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, is_private } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  // Создаём комнату
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: user.id,
      is_private: is_private ?? true,
    })
    .select('id')
    .single()

  if (roomErr || !room) {
    console.error('Room create error:', roomErr)
    return NextResponse.json({ error: roomErr?.message ?? 'Failed to create room' }, { status: 500 })
  }

  // Добавляем owner как участника (на случай если триггер не сработал)
  const { error: memberErr } = await supabase
    .from('room_members')
    .upsert({
      room_id: room.id,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
      invited_by: user.id,
    }, { onConflict: 'room_id,user_id' })

  if (memberErr) {
    console.error('Room member error:', memberErr)
    // Не фатально — комната создана, просто membership могло не добавиться
  }

  return NextResponse.json({ id: room.id })
}
