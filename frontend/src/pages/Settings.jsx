import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, resetAllData } from '@/lib/db';
import { motion } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import { Bell, Lock, Fingerprint, Shield, Trash2, Sparkles, Download, Upload, X } from 'lucide-react';
import { isBiometricAvailable, enrollBiometric, disableBiometric } from '@/lib/webauthn';
import { hashPin } from '@/lib/crypto';

export default function Settings() {
  const settings = useLiveQuery(() => db.settings.get('main'));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [bioAvail, setBioAvail] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvail);
  }, []);

  const updateSetting = async (key, value) => {
    await db.settings.update('main', { [key]: value });
  };

  const handleResetData = async () => {
    await resetAllData();
    setShowResetConfirm(false);
    window.location.reload();
  };

  const toggleBiometric = async () => {
    if (settings.biometric) {
      if (confirm('Disable Face ID / Touch ID?')) {
        await disableBiometric();
      }
    } else {
      try {
        await enrollBiometric();
      } catch (e) {
        alert('Failed to set up biometric authentication.');
      }
    }
  };

  const savePasscode = async () => {
    if (passcodeInput.length < 4) {
      alert('Passcode must be at least 4 digits');
      return;
    }
    const hashed = await hashPin(passcodeInput);
    await updateSetting('passcode', hashed);
    setShowPasscodeModal(false);
    setPasscodeInput('');
  };

  const removePasscode = async () => {
    if (confirm('Remove passcode? This will also disable biometric access.')) {
      await updateSetting('passcode', null);
      await disableBiometric();
    }
  };

  const exportData = async () => {
    const allData = {};
    const tableNames = db.tables.map(t => t.name);
    for (const name of tableNames) {
      allData[name] = await db.table(name).toArray();
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm('Importing data will overwrite existing records. Proceed?')) {
          for (const tableName in data) {
            if (db.tables.some(t => t.name === tableName)) {
              await db.table(tableName).clear();
              await db.table(tableName).bulkAdd(data[tableName]);
            }
          }
          alert('Data imported successfully. Reloading...');
          window.location.reload();
        }
      } catch (err) {
        alert('Failed to import data: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!settings) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" /></div>;
  }

  const items = [
    { id: 'notifications', icon: Bell, title: 'Notifications', subtitle: settings.notifications ? 'Status: granted' : 'Disabled', action: () => updateSetting('notifications', !settings.notifications), actionLabel: settings.notifications ? 'Enabled' : 'Enable', active: settings.notifications },
    { id: 'ai', icon: Sparkles, title: 'AI Provider', subtitle: `Current: ${settings.aiProvider === 'gemini' ? 'Gemini' : 'Groq Llama'}`, action: () => updateSetting('aiProvider', settings.aiProvider === 'gemini' ? 'groq' : 'gemini'), actionLabel: settings.aiProvider === 'gemini' ? 'Gemini' : 'Groq', active: true },
    {
      id: 'passcode',
      icon: Lock,
      title: 'Passcode',
      subtitle: settings.passcode ? 'Enabled' : 'Not set',
      action: settings.passcode ? removePasscode : () => setShowPasscodeModal(true),
      actionLabel: settings.passcode ? 'Remove' : 'Set',
      active: !!settings.passcode
    },
    {
      id: 'biometric',
      icon: Fingerprint,
      title: 'Face ID / Touch ID',
      subtitle: settings.biometric ? 'Enrolled' : 'Not enrolled',
      action: toggleBiometric,
      actionLabel: settings.biometric ? 'Disable' : 'Enable',
      active: settings.biometric,
      hidden: !bioAvail
    },
    { id: 'backup', icon: Download, title: 'Backup & Export', subtitle: 'Download all data as JSON', action: exportData, actionLabel: 'Export' },
    { id: 'import', icon: Upload, title: 'Import Data', subtitle: 'Restore from JSON backup', action: () => document.getElementById('import-input').click(), actionLabel: 'Import' },
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="settings-page">
      <input type="file" id="import-input" className="hidden" accept=".json" onChange={importData} />
      <div className="flex-shrink-0 px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">SYSTEM</p>
        <GiantHeading className="leading-[0.9]">SETTINGS</GiantHeading>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-40 scrollbar-hide">
        {items.filter(item => !item.hidden).map(item => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="bg-white/80 backdrop-blur-sm rounded-[1.75rem] p-4 flex items-center gap-4 shadow-sm border border-white/60" data-testid={`setting-${item.id}`}>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
              </div>
              <button
                onClick={item.action}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                  item.active 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`action-${item.id}`}
              >
                {item.actionLabel}
              </button>
            </div>
          );
        })}

        {/* Wipe data - destructive */}
        <div className="bg-white/80 backdrop-blur-sm rounded-[1.75rem] p-4 flex items-center gap-4 shadow-sm border border-white/60">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-red-600">Wipe all data</h3>
            <p className="text-xs text-gray-500 mt-0.5">Cannot be undone</p>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-5 py-2 rounded-full font-semibold text-sm bg-red-600 text-white hover:bg-red-700"
            data-testid="wipe-data-button"
          >
            Open
          </button>
        </div>

        <div className="text-center py-8 text-xs text-gray-400">
          <p>Life OS • Offline-first • Local only</p>
          <p className="mt-1">Version 2.0</p>
        </div>
      </div>
      {showResetConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-[2rem] p-6 max-w-[400px] w-full" data-testid="reset-confirm-modal">
            <div className="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Reset All Data?</h2>
            <p className="text-sm text-gray-500 text-center mb-6">All tasks, roadmaps, habits, and personal data will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-full bg-gray-100 font-semibold" data-testid="cancel-reset-button">Cancel</button>
              <button onClick={handleResetData} className="flex-1 py-3 rounded-full bg-red-600 text-white font-semibold" data-testid="confirm-reset-button">Reset</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Passcode setup modal */}
      {showPasscodeModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-[2rem] p-6 max-w-[400px] w-full">
            <button onClick={() => setShowPasscodeModal(false)} className="float-right w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Set Passcode</h2>
            <p className="text-sm text-gray-500 text-center mb-4">Enter a 4-6 digit passcode</p>
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-full p-4 bg-gray-100 rounded-2xl text-center text-2xl outline-none tracking-[0.5em]"
              data-testid="passcode-input"
              autoFocus
            />
            <button onClick={savePasscode} className="w-full mt-4 py-3 rounded-full bg-black text-white font-semibold" data-testid="save-passcode">Save Passcode</button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
