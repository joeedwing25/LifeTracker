import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { db } from '@/lib/db';
import { hashPin } from '@/lib/crypto';
import { isBiometricAvailable, enrollBiometric, verifyBiometric } from '@/lib/webauthn';
import GiantHeading from './GiantHeading';

const Dot = ({ filled }) => (
  <span className={`w-3.5 h-3.5 rounded-full transition-colors duration-200 ${filled ? 'bg-black' : 'bg-black/15'}`} />
);

export default function LockScreen({ onUnlock, settings }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState(settings?.passcode ? 'unlock' : 'create');
  const [draft, setDraft] = useState('');
  const [bioAvail, setBioAvail] = useState(false);
  const storedHash = settings?.passcode;
  const hasBio = settings?.biometric;

  useEffect(() => {
    setMode(settings?.passcode ? 'unlock' : 'create');
  }, [settings?.passcode]);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvail);
  }, []);

  // Auto-prompt biometric on unlock if enrolled
  useEffect(() => {
    if (mode !== 'unlock' || !hasBio) return;

    const triggerBio = async () => {
      try {
        const ok = await verifyBiometric();
        if (ok) onUnlock();
      } catch (e) {
        console.error('Biometric auto-prompt failed:', e);
      }
    };

    // Small delay to allow transition to finish
    const timer = setTimeout(triggerBio, 500);
    return () => clearTimeout(timer);
  }, [mode, hasBio, onUnlock]);

  const press = (n) => {
    setError('');
    if (mode === 'unlock') {
      if (pin.length < 6) setPin(p => p + n);
    } else {
      if (draft.length < 6) setDraft(p => p + n);
    }
  };

  const back = () => {
    if (mode === 'unlock') setPin(p => p.slice(0, -1));
    else setDraft(p => p.slice(0, -1));
  };

  useEffect(() => {
    if (mode === 'unlock' && pin.length >= 4) {
      // For simplicity, we check on every digit if it's at least 4
      // In a real app we might wait for a specific length or an "Enter" button
      // But the original logic matched on exact length if it's 4.
      // Current settings allow 4-6 digits. Let's handle 4-6.

      const checkPin = async () => {
        const h = await hashPin(pin);
        if (h === storedHash) {
          onUnlock();
        } else if (pin.length === 6) {
          setError('Incorrect Passcode');
          setPin('');
        }
      };
      checkPin();
    }
  }, [pin, mode, storedHash, onUnlock]);

  const handleSavePasscode = async () => {
    if (draft.length < 4) {
      setError('Minimum 4 digits required');
      return;
    }
    const h = await hashPin(draft);
    await db.settings.update('main', { passcode: h });

    // Try to enroll biometric automatically
    if (await isBiometricAvailable()) {
      try {
        await enrollBiometric();
      } catch (e) {
        console.log('Biometric enrollment skipped or failed');
      }
    }
    onUnlock();
  };

  const tryBiometric = async () => {
    try {
      if (!hasBio) {
        await enrollBiometric();
        onUnlock();
        return;
      }
      const ok = await verifyBiometric();
      if (ok) onUnlock();
      else setError('Biometric failed');
    } catch (e) {
      setError('Biometric unavailable');
    }
  };

  const value = mode === 'unlock' ? pin : draft;
  const title = mode === 'unlock' ? 'ENTER PASSCODE' : 'SET PASSCODE';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-[#F5F7FA] flex flex-col items-center justify-between px-5 pt-8 pb-16 mx-auto max-w-[430px]"
      data-testid="lock-screen"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)'
      }}
    >
      <div className="flex flex-col items-center w-full mt-8">
        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-black" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2 text-center">SECURE ACCESS</p>
        <GiantHeading className="text-4xl text-center leading-tight">{title}</GiantHeading>

        <div className="flex gap-4 mt-10 h-4" data-testid="pin-dots">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Dot key={i} filled={i < value.length} />
          ))}
        </div>

        <div className="h-6 mt-4">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-600 font-semibold"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>

      <div className="w-full max-w-[320px] space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => press(String(n))}
              className="h-16 rounded-2xl bg-white shadow-sm text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
              data-testid={`pin-${n}`}
            >
              {n}
            </button>
          ))}
          <div className="flex items-center justify-center">
            {bioAvail && (
              <button
                onClick={tryBiometric}
                className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                data-testid="pin-bio"
              >
                <Fingerprint className="w-8 h-8 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => press('0')}
            className="h-16 rounded-2xl bg-white shadow-sm text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            data-testid="pin-0"
          >
            0
          </button>
          <button
            onClick={back}
            className="h-16 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
            data-testid="pin-back"
          >
            <Delete className="w-7 h-7 text-gray-400" />
          </button>
        </div>

        {mode === 'create' && (
          <button
            onClick={handleSavePasscode}
            disabled={draft.length < 4}
            className="w-full py-4 rounded-3xl bg-black text-white font-bold shadow-lg disabled:opacity-50 transition-all"
            data-testid="save-passcode-button"
          >
            CONFIRM PASSCODE
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 font-medium text-center max-w-[240px]">
        {mode === 'create'
          ? 'Choose a 4-6 digit passcode. Biometric access will be enabled if supported.'
          : hasBio ? 'Unlock with your passcode or Face ID / Touch ID.' : 'Enter your secure passcode to unlock Life OS.'}
      </p>
    </motion.div>
  );
}
