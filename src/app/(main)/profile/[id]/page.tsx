import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import PublicProfile from '@/components/profile/PublicProfile'

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: listings }, { data: reviews }, { data: followRow }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('listings').select('*').eq('seller_id', id).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('reviews').select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)').eq('seller_id', id).order('created_at', { ascending: false }),
    user ? supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).single() : Promise.resolve({ data: null }),
  ])

  if (!profile) notFound()

  const isOwner = user?.id === id

  // Если владелец — редирект на свой профиль (через client-side не нужно, просто показываем тот же компонент)
  if (isOwner) {
    // Показываем публичный вид своего профиля — как его видят другие
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.name}
          </p>
          {profile.location && (
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>{profile.location}</p>
          )}
        </div>
      </div>
      <PublicProfile
        profile={profile}
        listings={listings ?? []}
        reviews={reviews ?? []}
        isFollowing={!!followRow}
        isOwner={isOwner}
        currentUserId={user!.id}
      />
    </div>
  )
}
