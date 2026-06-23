import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Check, Play, Trash2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const SWIPE_THRESHOLD = 150;

function TaskCard({
  task,
  onToggle,
  onDelete,
  onFocus,
  onReschedule,
  isSubtask = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const taskId = task?.id;
  const subtasks = useLiveQuery(
    () => (taskId ? db.tasks.where('parentId').equals(taskId).toArray() : Promise.resolve([])),
    [taskId]
  ) || [];

  const completedSubtasks = subtasks.filter(st => st.completed).length;

  const x = useMotionValue(0);

  const rightBg = useTransform(x, [0, SWIPE_THRESHOLD], ['#F3F4F6', '#EF4444']);
  const rightOpacity = useTransform(x, [0, SWIPE_THRESHOLD / 2], [0, 1]);
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.8, 1.1]);

  const leftBg = useTransform(x, [-SWIPE_THRESHOLD, 0], ['#3B82F6', '#F3F4F6']);
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD / 2, 0], [1, 0]);
  const leftScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1.1, 0.8]);

  const dragging = useRef(false);

  const onDragStart = () => {
    dragging.current = true;
  };

  const onDragEnd = (_, info) => {
    const offset = info.offset.x;

    if (offset > SWIPE_THRESHOLD) {
      if (window.navigator?.vibrate) window.navigator.vibrate(10);
      onDelete?.(task.id);
    } else if (offset < -SWIPE_THRESHOLD) {
      if (window.navigator?.vibrate) window.navigator.vibrate(10);
      onReschedule?.(task);
    }

    x.set(0);
    setTimeout(() => { dragging.current = false; }, 80);
  };

  const guard = (fn) => (e) => {
    if (dragging.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    fn?.(e);
  };

  if (!task) return null;

  const isHealthTask = task.isHealth || task.keyword === 'health' || task.keyword === 'fitness';

  return (
    <div className={`relative ${isSubtask ? 'mb-2 ml-4' : 'mb-3'} rounded-[1.75rem] overflow-hidden`} data-testid={`task-card-${task.id}`}>
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <motion.div
          style={{ backgroundColor: rightBg, opacity: rightOpacity }}
          className="absolute inset-0 flex items-center pl-8 text-white font-bold"
        >
          <motion.div style={{ scale: rightScale }} className="flex items-center gap-2">
            <Trash2 size={24} />
            <span>DELETE</span>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ backgroundColor: leftBg, opacity: leftOpacity }}
          className="absolute inset-0 flex items-center justify-end pr-8 text-white font-bold"
        >
          <motion.div style={{ scale: leftScale }} className="flex items-center gap-2">
            <span>RESCHEDULE</span>
            <Clock size={24} />
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragMomentum={false}
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`relative z-10 flex items-center gap-4 p-4 border border-white/60 backdrop-blur-sm shadow-sm transition-colors ${
          isHealthTask ? 'bg-green-50/80' : 'bg-white/80'
        } rounded-[1.75rem]`}
      >
        <button
          onClick={guard((e) => {
            e.stopPropagation();
            onToggle(task.id, task.completed);
          })}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            task.completed ? 'bg-black border-black' : isHealthTask ? 'border-green-400' : 'border-gray-300'
          }`}
          data-testid={`task-checkbox-${task.id}`}
        >
          {task.completed && <Check className="w-4 h-4 text-white" />}
        </button>

        <div className="flex-1 min-w-0" onClick={guard(() => {
          if (subtasks.length > 0) setExpanded(!expanded);
          else onReschedule?.(task);
        })}>
          <div className="flex items-center gap-2">
            {subtasks.length > 0 && (
              <span className="text-gray-400">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            <h3 className={`font-bold text-base truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
              {isHealthTask && <span className="ml-2 text-xs font-semibold text-green-600">●</span>}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-medium">
            {!isSubtask && (
              <>
                <Clock size={12} className="text-gray-400" />
                <span>{task.time || '09:00'}</span>
              </>
            )}
            {task.keyword && task.keyword !== 'general' && (
              <>
                {!isSubtask && <span>•</span>}
                <span className="font-bold" style={{ color: task.priority === 'high' ? '#EF4444' : '#6B7280' }}>
                  #{task.keyword}
                </span>
              </>
            )}
            {subtasks.length > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-600 font-bold">{completedSubtasks}/{subtasks.length} subtasks</span>
              </>
            )}
            {task.repeat && task.repeat !== 'once' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">↻ {task.repeat}</span>
            )}
            {task.priority && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#10B981' }}
              />
            )}
          </div>
        </div>

        {!task.completed && (
          <div className="flex items-center gap-2">
            <button
              onClick={guard(() => onReschedule?.(task))}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Clock size={14} />
            </button>
            <button
              onClick={guard(() => onFocus?.(task.id))}
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform flex-shrink-0"
              data-testid={`task-play-${task.id}`}
            >
              <Play className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        )}
      </motion.div>

      {expanded && subtasks.length > 0 && (
        <div className="mt-1 border-l-2 border-gray-100 ml-6 pl-2">
          {subtasks.map(st => React.createElement(TaskCard, {
            key: st.id,
            task: st,
            onToggle: (id, completed) => db.tasks.update(id, { completed: !completed }),
            onDelete: (id) => db.tasks.delete(id),
            onReschedule: onReschedule,
            onFocus: onFocus,
            isSubtask: true
          }))}
        </div>
      )}
    </div>
  );
}

export default TaskCard;
