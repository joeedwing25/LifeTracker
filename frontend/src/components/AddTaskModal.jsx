import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { scheduleTaskNotification } from '@/lib/notifications';
import { Calendar, Clock, Plus, Tag, RotateCw, ChevronDown } from 'lucide-react';

const FOCUS_DURATIONS = [15, 25, 45, 60, 90, 120];
const REPEAT_OPTIONS = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Pick days' },
];

export default function AddTaskModal({ isOpen, onClose, defaultDate, onTaskAdded }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [focus, setFocus] = useState(25);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState(null);
  const [repeat, setRepeat] = useState('once');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const modalRef = useRef(null);

  const roadmaps = useLiveQuery(() => db.roadmaps.toArray());

  // Handle keyboard appearance on iOS using VisualViewport API
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(offset > 50 ? offset : 0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, [isOpen]);

  // Parse hashtags from title to auto-link roadmap
  useEffect(() => {
    if (!roadmaps) return;
    const hashtagMatch = title.match(/#(\w+)/);
    if (hashtagMatch) {
      const tagName = hashtagMatch[1].toLowerCase();
      const matchedRoadmap = roadmaps.find(r => r.keyword.toLowerCase() === tagName);
      if (matchedRoadmap) {
        setSelectedRoadmapId(matchedRoadmap.id);
      }
    }
  }, [title, roadmaps]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      const selectedRoadmap = roadmaps?.find(r => r.id === selectedRoadmapId);
      const cleanTitle = title.replace(/#\w+/g, '').trim();

      const taskData = {
        title: cleanTitle || title.trim(),
        date,
        time,
        duration: focus,
        completed: false,
        roadmapId: selectedRoadmapId || null,
        keyword: selectedRoadmap?.keyword || 'general',
        priority: 'medium',
        deadline: null,
        repeat,
        isHealth: selectedRoadmap?.keyword === 'health' || selectedRoadmap?.keyword === 'fitness',
        createdAt: new Date().toISOString()
      };

      const newId = await db.tasks.add(taskData);
      console.log('✅ Task added with id:', newId, taskData);
      if (onTaskAdded) onTaskAdded({ ...taskData, id: newId });

      // Schedule notification
      await scheduleTaskNotification({ ...taskData, id: newId });

      // Reset form
      setTitle(''); setSelectedRoadmapId(null); setRepeat('once'); setFocus(25);
      onClose();
    } catch (err) {
      console.error('❌ Failed to add task:', err);
      alert('Failed to add task: ' + err.message);
    }
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={modalRef}
            initial={{ y: '100%' }}
            animate={{ y: -keyboardOffset }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 mx-auto max-w-[430px] bg-white rounded-t-[2.5rem] p-6 max-h-[90dvh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="add-task-modal"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 1.5rem)' }}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />

            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full text-lg p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none placeholder-gray-400 mb-4"
              autoFocus
              data-testid="task-title-input"
            />

            {/* Date and Focus Row */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5 flex items-center gap-1.5 px-1">
                  <Calendar className="w-3 h-3" />
                  DATE
                </label>
                <div className="relative h-12">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                    data-testid="task-date-input"
                  />
                  <div className="absolute inset-0 bg-gray-50 border border-gray-100 rounded-2xl flex items-center px-4 font-semibold text-sm z-10">
                    {formatDateLabel(date)}
                  </div>
                </div>
              </div>
              <div className="w-1/3">
                <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5 flex items-center gap-1.5 px-1">
                  <Clock className="w-3 h-3" />
                  FOCUS
                </label>
                <div className="relative h-12">
                  <select
                    value={focus}
                    onChange={(e) => setFocus(parseInt(e.target.value))}
                    className="w-full h-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-base font-semibold appearance-none cursor-pointer pr-10"
                    data-testid="task-focus-input"
                  >
                    {FOCUS_DURATIONS.map(d => (
                      <option key={d} value={d}>{`${d} min`}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Time Picker */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5 flex items-center gap-1.5 px-1">
                <Clock className="w-3 h-3" />
                TIME
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-12 p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-semibold text-sm"
                data-testid="task-time-input"
              />
            </div>

            {/* Roadmap Tags */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1.5 px-1">
                <Tag className="w-3 h-3" />
                ROADMAP (OPTIONAL)
              </label>
              <div className="flex flex-wrap gap-2">
                {(roadmaps || []).map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoadmapId(selectedRoadmapId === r.id ? null : r.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                      selectedRoadmapId === r.id
                        ? 'bg-black text-white shadow-md'
                        : 'bg-transparent text-gray-900'
                    }`}
                  >
                    #{r.keyword}
                  </button>
                ))}
                {roadmaps && roadmaps.length === 0 && (
                  <span className="text-xs text-gray-400 px-1 italic">No roadmaps created yet</span>
                )}
              </div>
            </div>

            {/* Repeat */}
            <div className="mb-8">
              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1.5 px-1">
                <RotateCw className="w-3 h-3" />
                REPEAT
              </label>
              <div className="flex flex-wrap gap-2">
                {REPEAT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setRepeat(opt.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      repeat === opt.id
                        ? 'bg-black text-white'
                        : 'bg-gray-50 text-gray-700 border border-gray-100'
                    }`}
                    data-testid={`repeat-${opt.id}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="flex-[1.5] py-4 rounded-3xl bg-black text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                data-testid="add-task-submit"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-3xl bg-white text-gray-900 border border-gray-200 font-bold hover:bg-gray-50 active:scale-[0.98] transition-all"
                data-testid="add-task-cancel"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
