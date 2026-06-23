import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function GlassCard({ children, className, hoverable = true, ...props }) {
  return (
    <motion.div
      className={cn(
        'backdrop-blur-2xl bg-white/70 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] p-6',
        hoverable && 'transition-all duration-300 hover:shadow-[0_12px_48px_rgba(0,0,0,0.08)] hover:-translate-y-1',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}