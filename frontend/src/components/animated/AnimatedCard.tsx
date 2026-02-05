/**
 * Animated Card Component
 * Анимированная карточка для товаров в каталоге
 */

import { motion } from 'framer-motion'
import { bikeCardVariants, useReducedMotion, useInView } from '@/animations'
import { ReactNode } from 'react'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  delay?: number
  enableHover?: boolean
}

export function AnimatedCard({
  children,
  className = '',
  onClick,
  delay = 0,
  enableHover = true,
}: AnimatedCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ref, isInView } = useInView()

  return (
    <motion.div
      ref={ref}
      className={className}
      onClick={onClick}
      variants={prefersReducedMotion ? undefined : bikeCardVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      whileHover={enableHover && !prefersReducedMotion ? 'hover' : undefined}
      whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
      transition={{ delay }}
      style={{
        transformOrigin: 'center',
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Bike Card Image Wrapper
 * Обертка для изображения в карточке с zoom эффектом
 */
interface AnimatedCardImageProps {
  children: ReactNode
  className?: string
}

export function AnimatedCardImage({ children, className = '' }: AnimatedCardImageProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      whileHover={!prefersReducedMotion ? { scale: 1.05 } : undefined}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        backfaceVisibility: 'hidden',
      }}
    >
      {children}
    </motion.div>
  )
}
