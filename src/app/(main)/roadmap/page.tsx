'use client'

import { useRouter } from 'next/navigation'
import RoadmapClient from '@/components/profile/RoadmapClient'

export default function RoadmapPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0F' }}>
      <RoadmapClient />
    </div>
  )
}
