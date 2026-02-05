import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Mockup, MockupFrame } from '@/components/ui/mockup'

export interface TabletAnimationSectionProps extends React.HTMLAttributes<HTMLElement> {}

const TabletAnimationSection = React.forwardRef<HTMLElement, TabletAnimationSectionProps>(
  ({ className, ...props }, ref) => {
    return (
      <section
        ref={ref}
        className={cn('relative z-10 flex w-full items-center justify-center bg-background py-16', className)}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ease: 'easeInOut', delay: 0.25, duration: 0.8 }}
          className="flex items-center justify-center"
        >
          <Mockup type="responsive" className="max-w-[900px] w-full">
            <MockupFrame size="large" className="bg-background/5">
              <div
                aria-hidden
                className="h-[420px] w-full rounded-xl bg-gradient-to-br from-muted/15 via-muted/10 to-muted/5 animate-pulse"
              />
            </MockupFrame>
          </Mockup>
        </motion.div>
      </section>
    )
  },
)

TabletAnimationSection.displayName = 'TabletAnimationSection'

export { TabletAnimationSection }