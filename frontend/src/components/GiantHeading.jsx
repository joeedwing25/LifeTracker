import { cn } from '@/lib/utils';

export default function GiantHeading({ children, className, ...props }) {
  return (
    <h1
      className={cn(
        'text-[2.75rem] sm:text-7xl md:text-8xl font-black uppercase tracking-[-0.04em] leading-none',
        className
      )}
      style={{ fontFamily: '"Cabinet Grotesk", "Manrope", sans-serif', fontWeight: 900 }}
      {...props}
    >
      {children}
    </h1>
  );
}
