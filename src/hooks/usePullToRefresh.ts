'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PullToRefreshOptions {
  threshold?: number
  onRefresh?: () => Promise<void> | void
}

export interface PullToRefreshState {
  pullDistance: number
  isRefreshing: boolean
  triggered: boolean
  containerRef: React.RefObject<HTMLDivElement>
}

export function usePullToRefresh(options: PullToRefreshOptions = {}): PullToRefreshState {
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
        await new Promise(r => setTimeout(r, 800))
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, router])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop > 0) return
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }

    function onTouchMove(e: TouchEvent) {
      if (!isPulling.current || isRefreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { setPullDistance(0); return }
      const rubber = Math.min(dy * 0.45, threshold * 1.5)
      setPullDistance(rubber)
      setTriggered(rubber >= threshold)
      if (dy > 8) e.preventDefault()
    }

    function onTouchEnd() {
      if (!isPulling.current) return
      isPulling.current = false
      if (triggered && !isRefreshing) {
        doRefresh()
      } else {
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

  return { containerRef, pullDistance, isRefreshing, triggered }
}
