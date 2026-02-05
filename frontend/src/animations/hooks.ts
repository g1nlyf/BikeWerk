/**
 * Animation Hooks
 * Хуки для управления анимациями и accessibility
 */

import { useEffect, useState, useRef } from 'react'
import { useInView as useFramerInView } from 'framer-motion'

/**
 * Проверяет, предпочитает ли пользователь уменьшенные анимации
 * Использует prefers-reduced-motion media query
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(listener)
      return () => mediaQuery.removeListener(listener)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Хук для определения видимости элемента на экране
 * Возвращает ref и boolean состояние видимости
 */
export function useInView(options = {}) {
  const ref = useRef(null)
  const isInView = useFramerInView(ref, {
    once: true,
    margin: '-100px',
    ...options,
  })

  return { ref, isInView }
}

/**
 * Хук для управления анимациями с учетом reduced motion
 * Возвращает объект анимации или пустой объект
 */
export function useAnimation<T extends object>(animation: T): T | {} {
  const prefersReducedMotion = useReducedMotion()
  return prefersReducedMotion ? {} : animation
}

/**
 * Хук для последовательного появления элементов
 * Возвращает функцию для получения задержки анимации
 */
export function useStaggerDelay(baseDelay = 0, increment = 0.05) {
  return (index: number) => baseDelay + index * increment
}

/**
 * Хук для определения направления скролла
 */
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down')
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up')
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return scrollDirection
}

/**
 * Хук для определения позиции скролла
 */
export function useScrollPosition() {
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return scrollPosition
}

/**
 * Хук для управления hover состоянием
 */
export function useHover() {
  const [isHovered, setIsHovered] = useState(false)

  const onMouseEnter = () => setIsHovered(true)
  const onMouseLeave = () => setIsHovered(false)

  return {
    isHovered,
    hoverProps: {
      onMouseEnter,
      onMouseLeave,
    },
  }
}

/**
 * Хук для управления focus состоянием
 */
export function useFocus() {
  const [isFocused, setIsFocused] = useState(false)

  const onFocus = () => setIsFocused(true)
  const onBlur = () => setIsFocused(false)

  return {
    isFocused,
    focusProps: {
      onFocus,
      onBlur,
    },
  }
}

/**
 * Хук для управления видимостью элемента с задержкой
 */
export function useDelayedReveal(delay = 0) {
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealed(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return isRevealed
}

/**
 * Хук для ripple эффекта на кнопках
 */
export function useRipple() {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])

  const addRipple = (event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const id = Date.now()

    setRipples((prev) => [...prev, { x, y, id }])

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id))
    }, 600)
  }

  return { ripples, addRipple }
}

/**
 * Хук для parallax эффекта
 */
export function useParallax(speed = 0.5) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.scrollY * speed)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  return offset
}
