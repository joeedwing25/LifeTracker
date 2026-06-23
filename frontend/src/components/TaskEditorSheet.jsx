import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalIcon, Clock3, Flag, Plus, RotateCw, Tag, Trash2, StickyNote, ListTree, Check, X } from 'lucide-react';
import { ensurePermission, scheduleTaskNotification } from '@/lib/notifications';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

const REPEAT_OPTIONS = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom' },
];

const PRIORITIES = [
  { id: 'high', label: 'High', color: '#EF4444', dot: 'bg-red-500' },
  { id: 'medium', label: 'Medium', color: '#F59E0B', dot: 'bg-yellow-500' },
  { id: 'low', label: 'Low', color: '#10B981', dot: 'bg-green-500' },
];

const FOCUS_DURATIONS = [15, 25, 45, 60, 90, 120];

export default function TaskEditorSheet({ task, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [newSubtask, setNewSubtask] = useState('');
  const roadmaps = useLiveQuery(() => db.roadmaps.toArray()) || [];
  const subtasks = useLiveQuery(() => task?.id ? db.tasks.where('parentId').equals(task.id).toArray() : [], [task?.id]) || [];

  useEffect(() => {
    if (!task) {
      setDraft(null);
      return;
    }
    setDraft({
      title: task.title || '',
      date: task.date || new Date().toISOString().split('T')[0],
      time: task.time || '',
      keyword: task.keyword || 'general',
      priority: task.priority || 'medium',
      deadline: task.deadline || '',
      repeat: task.repeat || 'once',
      duration: task.duration || 25,
      notes: task.notes || '',
    });
  }, [task]);

  if (!task || !draft) return null;

  const setField = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

  const addSubtask = async () => {
    if (!newSubtask.trim() || !task?.id) return;
    await db.tasks.add({
      title: newSubtask.trim(),
      completed: false,
      parentId: task.id,
      date: draft.date,
      keyword: draft.keyword,
      priority: 'low',
      createdAt: new Date().toISOString()
    });
    setNewSubtask('');
  };

  const toggleSubtask = async (st) => {
    await db.tasks.update(st.id, { completed: !st.completed });
  };

  const deleteSubtask = async (id) => {
    await db.tasks.delete(id);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!draft.title.trim()) return;

    if (draft.time) {
      await ensurePermission();
    }

    const updatedTask = {
      ...task,
      ...draft,
      title: draft.title.trim(),
      isHealth: draft.keyword === 'health' || draft.keyword === 'fitness',
      updatedAt: new Date().toISOString(),
    };

    await onSave(updatedTask);
    if (updatedTask.time && updatedTask.date) {
      scheduleTaskNotification(updatedTask);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await onDelete(task.id);
      onClose();
    }
  };

  const target = typeof document !== 'undefined' ? document.body : null;

  const sheet = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[2.5rem] p-5 max-h-[90dvh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 1.5rem)' }}
      >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

          <form onSubmit={handleSave}>
            {/* Title */}
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Task title"
              className="w-full text-base p-3.5 bg-gray-100 rounded-2xl outline-none placeholder-gray-400 mb-3 font-semibold"
              autoFocus
            />

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                  <CalIcon className="w-3 h-3" /> DATE
                </label>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setField('date', e.target.value)}
                  className="w-full p-2.5 bg-gray-100 rounded-2xl outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                  <Clock3 className="w-3 h-3" /> TIME
                </label>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setField('time', e.target.value)}
                  className="w-full p-2.5 bg-gray-100 rounded-2xl outline-none text-sm font-semibold"
                />
              </div>
            </div>

            {/* Duration & Priority */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                  <Plus className="w-3 h-3" /> FOCUS
                </label>
                <select
                  value={draft.duration}
                  onChange={(e) => setField('duration', parseInt(e.target.value))}
                  className="w-full p-2.5 bg-gray-100 rounded-2xl outline-none text-sm font-semibold"
                >
                  {FOCUS_DURATIONS.map(d => (
                    <option key={d} value={d}>{d} mins</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                  <Flag className="w-3 h-3" /> PRIORITY
                </label>
                <div className="flex gap-1">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setField('priority', p.id)}
                      className={`flex-1 p-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                        draft.priority === p.id
                          ? 'bg-white border border-gray-300 shadow-sm'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      {p.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3 h-3" /> DEADLINE
              </label>
              <input
                type="date"
                value={draft.deadline}
                onChange={(e) => setField('deadline', e.target.value)}
                className="w-full p-2.5 bg-gray-100 rounded-2xl outline-none text-sm"
              />
            </div>

            {/* Repeat */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                <RotateCw className="w-3 h-3" /> REPEAT
              </label>
              <div className="flex flex-wrap gap-2">
                {REPEAT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setField('repeat', opt.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      draft.repeat === opt.id
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyword / Roadmap */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> KEYWORD
              </label>
              <input
                list="roadmaps-list"
                value={draft.keyword}
                onChange={(e) => setField('keyword', e.target.value)}
                className="w-full p-2.5 bg-gray-100 rounded-2xl outline-none text-sm"
              />
              <datalist id="roadmaps-list">
                {roadmaps.map(r => <option key={r.id} value={r.keyword} />)}
              </datalist>
            </div>

            {/* Subtasks */}
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                <ListTree className="w-3 h-3" /> SUBTASKS
              </label>

              <div className="space-y-2 mb-2">
                {subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(st)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        st.completed ? 'bg-black border-black text-white' : 'border-gray-300'
                      }`}
                    >
                      {st.completed && <Check className="w-3 h-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${st.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {st.title}
                    </span>
                    <button type="button" onClick={() => deleteSubtask(st.id)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                  placeholder="Add a subtask..."
                  className="flex-1 p-2.5 bg-gray-100 rounded-xl outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  className="px-3 bg-black text-white rounded-xl text-sm font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                <StickyNote className="w-3 h-3" /> NOTES
              </label>
              <textarea
                value={draft.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Add details..."
                rows={2}
                className="w-full p-3 bg-gray-100 rounded-2xl outline-none text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-full bg-gray-100 text-gray-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-12 rounded-full bg-black text-white font-bold shadow-lg"
              >
                Save
              </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );

  return target ? createPortal(sheet, target) : sheet;
}
