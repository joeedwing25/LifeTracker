import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useState } from 'react';

export default function FloatingAIOrb({ onClick }) {
  const [showRipple, setShowRipple] = useState(false);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowRipple(true);
    setTimeout(() => setShowRipple(false), 1000);
    if (onClick) onClick();
  };

  return (
    <motion.button
      data-testid="floating-ai-orb"
      onClick={handleClick}
      type="button"
      className="fixed z-40 w-12 h-12"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        right: 'calc(50% - 215px + 16px)', // Centered relative to mobile container
      }}
    >
      <div className="relative w-12 h-12 pointer-events-none">
        {/* Outer animated rainbow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #B983FF, #FF6B6B)',
            filter: 'blur(2px)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Glow */}
        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-blue-500/30 blur-xl animate-pulse" />

        {/* Ripple */}
        <AnimatePresence>
          {showRipple && (
            <motion.div
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 rounded-full border-2 border-purple-400 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Inner black core */}
        <div className="absolute inset-[3px] rounded-full bg-black flex items-center justify-center shadow-2xl">
          <Mic className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.button>
  );
}
