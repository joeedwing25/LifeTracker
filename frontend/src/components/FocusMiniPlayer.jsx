import { useMemo, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, completeFocusSession } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer } from 'lucide-react';

export default function FocusMiniPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('main'));
  const session = useMemo(() => settings?.activeSession, [settings]);

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!session || !session.isActive) return;

    const updateTimer = async () => {
      if (session.endTime) {
        const remaining = Math.max(0, Math.round((new Date(session.endTime) - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining === 0 && session.isActive) {
          await completeFocusSession(session.sessionStartTime, session.duration);
        }
      } else {
        setTimeLeft(session.timeLeft || 0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || !session.isActive || location.pathname === '/focus') {
    return null;
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress = ((session.duration * 60 - timeLeft) / (session.duration * 60)) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-full"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
        }}
        onClick={() => navigate('/focus')}
        data-testid="focus-mini-player"
      >
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 transform -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="3"
              fill="none"
            />
            <motion.circle
              cx="16"
              cy="16"
              r="14"
              stroke="#000000"
              strokeWidth="3"
              fill="none"
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={2 * Math.PI * 14 * (1 - progress / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Timer className="w-3.5 h-3.5 text-black" />
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 leading-none">Focusing</span>
          <span className="text-sm font-mono font-bold text-black tabular-nums">{formatTime(timeLeft)}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
