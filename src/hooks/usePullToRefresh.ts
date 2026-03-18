'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PullToRefreshOptions {
  threshold?: number   // px до срабатывания, default 72
  onRefresh?: () => Promise<void> | void  // кастомный коллбэк, иначе router.refresh()
}

export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const { threshold = 72, onRefresh } = options
  const router = useRouter()

  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const startY = useRef(0)
  const isPulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setTriggered(false)
    setPullDistance(0)
    try {
      if (onRefresh) {
        await onRefresh()
      } else {
        router.refresh()
        // Небольшая задержка чтобы spinner был виден
        await new Promise(r => setTimeout(r, 700))
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, router])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      // Срабатываем только если скролл в самом верху
      if (el!.scrollTop > 0) return
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }

    function onTouchMove(e: TouchEvent) {
      if (!isPulling.current || isRefreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { setPullDistance(0); return }

      // Rubber band — сопротивление при большом растяжении
      const rubber = Math.min(dy * 0.45, threshold * 1.5)
      setPullDistance(rubber)
      if (rubber >= threshold) setTriggered(true)
      else setTriggered(false)

      // Блокируем скролл браузера при пулле
      if (dy > 8) e.preventDefault()
    }

    function onTouchEnd() {
      if (!isPulling.current) return
      isPulling.current = false

      if (triggered && !isRefreshing) {
        doRefresh()
      } else {
        // Snap back анимация
        setPullDistance(0)
        setTriggered(false)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isRefreshing, triggered, threshold, doRefresh])

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 30,
    transform: `translateY(${Math.min(pullDistance, threshold * 1.2) - 44}px)`,
    transition: isRefreshing ? 'transform 0.3s var(--spring-smooth)' : 'none',
    height: 44,
  }

  const spinnerStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: '50%',
    background: 'white',
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: `scale(${Math.min(pullDistance / threshold, 1)})`,
    transition: isRefreshing ? 'none' : 'transform 0.1s',
    opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
  }

  // Индикатор — крутилка или галочка
  const Indicator = () => (
    <div style={indicatorStyle}>
      <div style={spinnerStyle}>
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

  return { containerRef, pullDistance, isRefreshing, Indicator }
}
