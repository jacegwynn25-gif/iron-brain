'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const variants = {
    initial: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      key={pathname}
      variants={variants}
      initial="initial"
      animate="animate"
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen"
      style={{ willChange: reduceMotion ? 'auto' : 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}
