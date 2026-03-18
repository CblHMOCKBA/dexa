'use client'

interface Props {
  pullDistance: number
  isRefreshing: boolean
  triggered: boolean
  threshold?: number
}

export default function PullIndicator({ pullDistance, isRefreshing, triggered, threshold = 72 }: Props) {
  const visible = pullDistance > 8 || isRefreshing
  const scale   = Math.min(pullDistance / threshold, 1)
  // Фиксированный поверх всего — выезжает сверху
  const topOffset = isRefreshing
    ? 'calc(var(--sat, 0px) + 14px)'
    : `calc(var(--sat, 0px) + ${Math.min(pullDistance, threshold * 1.2) - 44}px)`

  if (!visible && !isRefreshing) return null

  return (
    <div style={{
      position: 'fixed',
      top: topOffset,
      left: 0, right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 999,
      pointerEvents: 'none',
      transition: isRefreshing ? 'top 0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'white',
        boxShadow: '0 2px 16px rgba(0,0,0,0.14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${isRefreshing ? 1 : scale})`,
        transition: isRefreshing ? 'none' : 'transform 0.1s',
      }}>
        {isRefreshing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: 'spin 0.75s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        ) : triggered ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#00B173" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12l5 5L20 7"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#9498AB" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
        )}
      </div>
    </div>
  )
}
