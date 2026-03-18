import { createClient } from '@/lib/supabase/server'
import OwnProfile from '@/components/profile/OwnProfile'
import BottomNav from '@/components/ui/BottomNav'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: listings }, { data: reviews }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('listings').select('*').eq('seller_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('reviews').select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)').eq('seller_id', user!.id).order('created_at', { ascending: false }),
  ])

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      <div className="page-header pt-safe">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Мой профиль</h1>
      </div>
      <OwnProfile
        profile={profile!}
        listings={listings ?? []}
        reviews={reviews ?? []}
      />
    </div>
  )
}
