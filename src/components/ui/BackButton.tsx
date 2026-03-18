'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ href }: { href?: string }) {
  const router = useRouter()

  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      className="back-btn"
      aria-label="Назад"
    >
      {/* FIX: явный stroke цвет — был невидим из-за отсутствия currentColor */}
      <svg
        width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="#1E6FEB"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>
  )
}
