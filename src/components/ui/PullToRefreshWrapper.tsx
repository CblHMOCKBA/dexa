'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'

interface Props {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function PullToRefreshWrapper({ children, className, style }: Props) {
  const { containerRef, pullDistance, isRefreshing, Indicator } = usePullToRefresh()

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        // Сдвигаем контент вниз при пулле
        transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
        transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s var(--spring-smooth)' : 'none',
        ...style,
      }}
    >
      <Indicator />
      {children}
    </div>
  )
}
