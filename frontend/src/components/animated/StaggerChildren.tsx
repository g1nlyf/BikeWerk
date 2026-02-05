/**
 * Stagger Children Component
 * Последовательное появление дочерних элементов
 */

import { motion } from 'framer-motion'
import { staggerContainer, useReducedMotion, useInView } from '@/animations'
import { ReactNode } from 'react'

interface StaggerChildrenProps {
  children: ReactNode
  className?: string
  delay?: number
  staggerDelay?: number
}

export function StaggerChildren({
  children,
  className = '',
  delay = 0.1,
  staggerDelay = 0.08,
}: StaggerChildrenProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ref, isInView } = useInView()

  const customVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={prefersReducedMotion ? undefined : customVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

/**
 * Fade In When Visible
 * Появляется, когда входит в зону видимости
 */
interface FadeInWhenVisibleProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  once?: boolean
}

export function FadeInWhenVisible({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  once = true,
}: FadeInWhenVisibleProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ref, isInView } = useInView({ once })

  const directionOffset = {
    up: { y: 30 },
    down: { y: -30 },
    left: { x: 30 },
    right: { x: -30 },
    none: {},
  }

  const variants = {
    hidden: {
      opacity: 0,
      ...directionOffset[direction],
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={prefersReducedMotion ? undefined : variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

/**
 * Scale In When Visible
 * Увеличивается при появлении
 */
interface ScaleInWhenVisibleProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function ScaleInWhenVisible({
  children,
  className = '',
  delay = 0,
}: ScaleInWhenVisibleProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ref, isInView } = useInView()

  const variants = {
    hidden: {
      scale: 0.8,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        delay,
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={prefersReducedMotion ? undefined : variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}
