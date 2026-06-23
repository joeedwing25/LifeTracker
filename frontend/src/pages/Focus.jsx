import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, updateActiveSession, clearActiveSession, completeFocusSession } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import GlassCard from '@/components/GlassCard';
import { Play, Pause, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FOCUS_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

export default function Focus() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('main'));
  const session = useMemo(() => settings?.activeSession, [settings]);

  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Sync state with DB session
  useEffect(() => {
    if (session) {
      setIsActive(session.isActive);
      setDuration(session.duration);
      setSessionStartTime(session.sessionStartTime);
      
      if (session.isActive && session.endTime) {
        const remaining = Math.max(0, Math.round((new Date(session.endTime) - Date.now()) / 1000));
        setTimeLeft(remaining);
      } else {
        setTimeLeft(session.timeLeft || session.duration * 60);
      }
    }
  }, [session]);

  // Memoize handleSessionComplete so it's stable across renders
  const handleSessionComplete = useCallback(async () => {
    setIsActive(false);
    await completeFocusSession(sessionStartTime, duration);
  }, [sessionStartTime, duration]);

  useEffect(() => {
    let interval = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        if (session?.isActive && session?.endTime) {
          const remaining = Math.max(0, Math.round((new Date(session.endTime) - Date.now()) / 1000));
          setTimeLeft(remaining);
          if (remaining === 0) handleSessionComplete();
        } else {
          setTimeLeft((time) => {
            if (time <= 1) {
              handleSessionComplete();
              return 0;
            }
            return time - 1;
          });
        }
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleSessionComplete();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, handleSessionComplete, session]);

  const startSession = async () => {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + timeLeft * 1000).toISOString();
    const newSessionStartTime = sessionStartTime || startTime;

    setIsActive(true);
    setSessionStartTime(newSessionStartTime);

    await updateActiveSession({
      duration,
      endTime,
      isActive: true,
      sessionStartTime: newSessionStartTime,
      timeLeft: timeLeft
    });
  };

  const pauseSession = async () => {
    setIsActive(false);
    await updateActiveSession({
      ...session,
      isActive: false,
      timeLeft: timeLeft
    });
  };

  const resetSession = async () => {
    setIsActive(false);
    setTimeLeft(duration * 60);
    setSessionStartTime(null);
    await clearActiveSession();
  };

  const changeDuration = async (newDuration) => {
    setDuration(newDuration);
    setTimeLeft(newDuration * 60);
    setIsActive(false);
    setSessionStartTime(null);
    await clearActiveSession();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 to-black text-white pb-24" data-testid="focus-page">
      <div className="px-5 pt-8 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">MODE</p>
            <GiantHeading className="text-5xl md:text-7xl text-white">FOCUS</GiantHeading>
          </div>
          <button
            onClick={() => navigate('/')}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            data-testid="close-focus-button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="px-5 space-y-8 flex flex-col items-center justify-center" style={{ minHeight: 'calc(100dvh - 200px)' }}>
        {/* Timer Display */}
        <div className="relative">
          {/* Circular progress */}
          <svg className="w-80 h-80 transform -rotate-90">
            <circle
              cx="160"
              cy="160"
              r="150"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="160"
              cy="160"
              r="150"
              stroke="#ffffff"
              strokeWidth="8"
              fill="none"
              strokeDasharray={2 * Math.PI * 150}
              strokeDashoffset={2 * Math.PI * 150 * (1 - progress / 100)}
              strokeLinecap="round"
              initial={{ strokeDashoffset: 2 * Math.PI * 150 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 150 * (1 - progress / 100) }}
              transition={{ duration: 0.5 }}
            />
          </svg>

          {/* Time */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.h1 
              className="text-7xl font-bold mb-2 font-mono"
              key={timeLeft}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              data-testid="timer-display"
            >
              {formatTime(timeLeft)}
            </motion.h1>
            <p className="text-gray-400 text-lg">{duration} minute session</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isActive ? (
            <button
              onClick={startSession}
              className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
              data-testid="start-button"
            >
              <Play className="w-10 h-10 ml-1" />
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
              data-testid="pause-button"
            >
              <Pause className="w-10 h-10" />
            </button>
          )}
          
          {(isActive || timeLeft !== duration * 60) && (
            <button
              onClick={resetSession}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors font-semibold"
              data-testid="reset-button"
            >
              Reset
            </button>
          )}
        </div>

        {/* Duration Selection */}
        {!isActive && timeLeft === duration * 60 && (
          <div className="flex gap-3">
            {FOCUS_DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => changeDuration(d.value)}
                className={`px-6 py-3 rounded-full font-semibold transition-all ${
                  duration === d.value
                    ? 'bg-white text-black scale-110'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                data-testid={`duration-${d.value}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Tips */}
        {!isActive && (
          <div className="max-w-md">
            <GlassCard className="bg-white/5 border-white/10">
              <h3 className="font-semibold mb-2 text-white">Focus Tips</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Remove distractions from your workspace</li>
                <li>• Put your phone on Do Not Disturb</li>
                <li>• Take a break after each session</li>
                <li>• Stay hydrated</li>
              </ul>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
