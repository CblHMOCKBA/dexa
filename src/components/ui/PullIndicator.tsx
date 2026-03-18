'use client'

interface Props {
  pullDistance: number
  isRefreshing: boolean
  triggered: boolean
  threshold?: number
}

export default function PullIndicator({ pullDistance, isRefreshing, triggered, threshold = 72 }: Props) {
  const visible = pullDistance > 10 || isRefreshing
  const scale   = Math.min(pullDistance / threshold, 1)

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      pointerEvents: 'none',
      zIndex: 30,
      transform: `translateY(${Math.min(pullDistance, threshold * 1.2) - 44}px)`,
      transition: isRefreshing ? 'transform 0.3s ease' : 'none',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${isRefreshing ? 1 : scale})`,
        opacity: visible ? 1 : 0,
        transition: isRefreshing ? 'none' : 'transform 0.1s, opacity 0.1s',
      }}>
        {isRefreshing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        ) : triggered ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12l5 5L20 7"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#9498AB" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
        )}
      </div>
    </div>
  )
}
