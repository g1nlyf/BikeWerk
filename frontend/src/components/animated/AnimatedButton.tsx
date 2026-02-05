/**
 * Animated Button Component
 * Кнопка с ripple эффектом, loading и success состояниями
 */

import { motion, AnimatePresence } from 'framer-motion'
import { buttonVariants, rippleVariants, useReducedMotion, useRipple } from '@/animations'
import { ReactNode, ButtonHTMLAttributes } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  isSuccess?: boolean
  loadingText?: string
  enableRipple?: boolean
}

export function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  isSuccess = false,
  loadingText,
  enableRipple = true,
  onClick,
  disabled,
  ...props
}: AnimatedButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ripples, addRipple } = useRipple()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableRipple && !prefersReducedMotion) {
      addRipple(e)
    }
    onClick?.(e)
  }

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  }

  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8 text-lg',
  }

  return (
    <motion.button
      className={`
        relative overflow-hidden inline-flex items-center justify-center
        rounded-md font-medium transition-colors
        focus-visible:outline-none focus-visible:ring-2
        disabled:pointer-events-none disabled:opacity-50
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      variants={!prefersReducedMotion ? buttonVariants : undefined}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      onClick={handleClick}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Ripple effect */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full bg-white/30"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 10,
              height: 10,
              transform: 'translate(-50%, -50%)',
            }}
            variants={rippleVariants}
            initial="initial"
            animate="animate"
          />
        ))}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </motion.span>
        ) : isSuccess ? (
          <motion.span
            key="success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Check className="h-5 w-5" />
          </motion.span>
        ) : (
          <motion.span
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/**
 * Icon Button variant
 */
interface AnimatedIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
}

export function AnimatedIconButton({
  icon,
  label,
  className = '',
  ...props
}: AnimatedIconButtonProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center rounded-full
        w-10 h-10 hover:bg-accent transition-colors
        ${className}
      `}
      variants={!prefersReducedMotion ? buttonVariants : undefined}
      whileHover="hover"
      whileTap="tap"
      aria-label={label}
      {...props}
    >
      {icon}
    </motion.button>
  )
}
