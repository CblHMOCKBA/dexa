'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Options {
  threshold?: number
  onRefresh?: () => Promise<void> | void
}

export interface PTRState {
  pullDistance: number
  isRefreshing: boolean
  triggered: boolean
}

export function usePullToRefresh(options: Options = {}): PTRState {
  const { threshold = 72, onRefresh } = options
  const router = useRouter()

  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const startY   = useRef(0)
  const pulling  = useRef(false)
  const blocked  = useRef(false)

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setTriggered(false)
    setPullDistance(0)
    try {
      if (onRefresh) await onRefresh()
      else {
        router.refresh()
        await new Promise(r => setTimeout(r, 900))
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, router])

  useEffect(() => {
    // Слушаем window — работает для любого скролла страницы
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return   // не в самом верху — не тянем
      if (isRefreshing) return
      startY.current = e.touches[0].clientY
      pulling.current = true
      blocked.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || isRefreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { setPullDistance(0); return }

      // Rubber band
      const rubber = Math.min(dy * 0.45, threshold * 1.6)
      setPullDistance(rubber)
      setTriggered(rubber >= threshold)

      // Блокируем нативный скролл вверх
      if (dy > 6 && !blocked.current) {
        blocked.current = true
      }
      if (blocked.current) e.preventDefault()
    }

    function onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      blocked.current = false

      if (triggered && !isRefreshing) {
        doRefresh()
      } else {
        setPullDistance(0)
        setTriggered(false)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: false })
    document.addEventListener('touchend',   onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [isRefreshing, triggered, threshold, doRefresh])

  return { pullDistance, isRefreshing, triggered }
}
