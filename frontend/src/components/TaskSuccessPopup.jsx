import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock } from 'lucide-react';

export default function TaskSuccessPopup({ isVisible, task }) {
  if (!task) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed left-4 right-4 bottom-24 z-[100] flex justify-center pointer-events-none"
        >
          <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl p-4 flex items-center gap-3 max-w-[400px] w-full pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-0.5">Task Added</p>
              <h4 className="text-sm font-bold text-gray-900 truncate">{task.title}</h4>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 font-medium">
                <Clock className="w-3 h-3" />
                <span>{task.time || '09:00'}</span>
                <span>•</span>
                <span className="capitalize">{task.priority} Priority</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
