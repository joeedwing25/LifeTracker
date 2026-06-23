import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, Coffee, Palmtree } from 'lucide-react';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_MODES = [
  { id: 'working', label: 'Working', icon: Zap, color: '#3B82F6', bg: 'bg-blue-50', description: 'Optimal Performance', subtitle: 'High capacity for deep focus.' },
  { id: 'semi-work', label: 'Semi-Work', icon: Coffee, color: '#F59E0B', bg: 'bg-amber-50', description: 'Moderate Capacity', subtitle: 'Half of your tasks scheduled.' },
  { id: 'leave', label: 'Leave', icon: Palmtree, color: '#10B981', bg: 'bg-emerald-50', description: 'Rest Day', subtitle: 'Only essential tasks scheduled.' },
];

export default function Calendar() {
  const [viewMode, setViewStart] = useState('week'); // 'week' or 'month'
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(today.setDate(diff));
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const dayModes = useLiveQuery(() => db.dayModes.toArray()) || [];

  // Get week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const selectedDayMode = dayModes.find(dm => dm.date === selectedDateStr)?.mode || 'working';
  const selectedDayTasks = allTasks.filter(t => {
    if (t.parentId) return false;
    if (t.date === selectedDateStr) return true;
    if (t.repeat === 'daily') return true;
    if (t.repeat === 'weekly' && t.date) {
      return new Date(t.date).getDay() === selectedDate.getDay();
    }
    return false;
  });

  const isToday = (d) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const isSelected = (d) => d.toDateString() === selectedDate.toDateString();

  const prevPeriod = () => {
    if (viewMode === 'week') {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    } else {
      const d = new Date(currentMonth);
      d.setMonth(d.getMonth() - 1);
      setCurrentMonth(d);
    }
  };
  const nextPeriod = () => {
    if (viewMode === 'week') {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    } else {
      const d = new Date(currentMonth);
      d.setMonth(d.getMonth() + 1);
      setCurrentMonth(d);
    }
  };

  const setDayMode = async (mode) => {
    await db.dayModes.put({ date: selectedDateStr, mode });
  };

  const weekRangeLabel = viewMode === 'week'
    ? `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} — ${MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getDate()}`
    : `${MONTHS_SHORT[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const currentModeInfo = DAY_MODES.find(m => m.id === selectedDayMode) || DAY_MODES[0];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="calendar-page">
      {/* Fixed Top Section */}
      <div className="flex-shrink-0 px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center">
              <CalendarIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Calendar</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setViewStart('week')}
                  className={`text-[10px] uppercase tracking-[0.25em] font-bold ${viewMode === 'week' ? 'text-black' : 'text-gray-400'}`}
                >WEEK</button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setViewStart('month')}
                  className={`text-[10px] uppercase tracking-[0.25em] font-bold ${viewMode === 'month' ? 'text-black' : 'text-gray-400'}`}
                >MONTH</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevPeriod} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center" data-testid="prev-period-button">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextPeriod} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center" data-testid="next-period-button">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-600 mb-4">{weekRangeLabel}</p>

        {viewMode === 'week' ? (
        /* Week Day Selector */
        <div className="grid grid-cols-7 gap-2 mb-6">
          {weekDays.map((d, i) => {
            const selected = isSelected(d);
            const today = isToday(d);
            const dayModeData = dayModes.find(dm => dm.date === d.toISOString().split('T')[0]);
            const mode = dayModeData?.mode;

            // Apply tinted background based on mode
            let modeBg = 'bg-white';
            let modeTextColor = 'text-gray-700';
            let modeDateColor = '';
            let dotColor = '';
            
            if (selected) {
              modeBg = 'bg-black';
              modeTextColor = 'text-white';
            } else if (mode === 'semi-work') {
              modeBg = 'bg-orange-50';
              modeDateColor = 'text-orange-700';
              dotColor = 'bg-orange-500';
            } else if (mode === 'leave') {
              modeBg = 'bg-gray-100';
              modeTextColor = 'text-gray-400';
              modeDateColor = 'text-gray-400';
              dotColor = 'bg-gray-400';
            } else if (mode === 'working') {
              dotColor = 'bg-blue-500';
            }

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                data-testid={`week-day-${i}`}
                className={`relative rounded-2xl p-3 transition-all ${modeBg} ${
                  selected ? 'shadow-lg scale-105' : 'hover:shadow-md'
                }`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  selected ? 'text-white/60' : modeTextColor === 'text-gray-400' ? 'text-gray-400' : 'text-gray-400'
                }`}>
                  {DAY_NAMES[d.getDay()]}
                </p>
                <p className={`text-xl font-bold mt-0.5 ${
                  selected ? 'text-white' : modeDateColor || 'text-gray-900'
                }`}>{d.getDate()}</p>
                {dotColor && !selected && (
                  <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${dotColor}`} />
                )}
                {today && !selected && !mode && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
        ) : (
          /* Month Grid Selector */
          <div className="grid grid-cols-7 gap-1 mb-6">
            {DAY_NAMES.map(day => (
              <p key={day} className="text-[8px] font-black text-gray-400 text-center mb-1">{day}</p>
            ))}
            {(() => {
              const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
              const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
              const daysInMonth = endOfMonth.getDate();
              const startDay = startOfMonth.getDay(); // 0 = Sun

              const cells = [];
              // Empty cells for previous month
              for (let i = 0; i < startDay; i++) {
                cells.push(<div key={`empty-${i}`} className="h-10" />);
              }

              for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                const dateStr = date.toISOString().split('T')[0];
                const selected = isSelected(date);
                const today = isToday(date);
                const hasTasks = allTasks.some(t => {
                  if (t.parentId) return false;
                  if (t.date === dateStr) return true;
                  if (t.repeat === 'daily') return true;
                  if (t.repeat === 'weekly' && t.date) return new Date(t.date).getDay() === date.getDay();
                  return false;
                });

                cells.push(
                  <button
                    key={d}
                    onClick={() => setSelectedDate(date)}
                    className={`h-10 relative rounded-xl flex flex-col items-center justify-center transition-all ${
                      selected ? 'bg-black text-white' : today ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{d}</span>
                    {hasTasks && !selected && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${today ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    )}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
        )}

        {/* Intelligence Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-5 shadow-sm border border-white/60" data-testid="intelligence-section">
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">INTELLIGENCE</p>
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl ${currentModeInfo.bg} flex items-center justify-center flex-shrink-0`}>
              <currentModeInfo.icon className="w-6 h-6" style={{ color: currentModeInfo.color }} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{currentModeInfo.description}</h3>
              <p className="text-sm text-gray-500">{currentModeInfo.subtitle}</p>
            </div>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 opacity-50" />
            </motion.div>
          </div>

          {/* Day Mode Selector */}
          <div className="grid grid-cols-3 gap-2">
            {DAY_MODES.map(mode => {
              const Icon = mode.icon;
              const isActive = selectedDayMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setDayMode(mode.id)}
                  data-testid={`day-mode-${mode.id}`}
                  className={`p-4 rounded-2xl text-center transition-all flex flex-col items-center gap-2 ${
                    isActive
                      ? 'bg-black text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-bold">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable Schedule Section */}
      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        {/* Selected Day Tasks */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">SCHEDULE</p>
          {selectedDayTasks.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 text-center border border-white/60">
              <p className="text-gray-500 text-sm">
                {selectedDayMode === 'leave' ? "Rest day. No tasks." : "No tasks scheduled."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDayTasks.map(task => (
                <div key={task.id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3 border border-white/60" data-testid={`schedule-task-${task.id}`}>
                  <div className="text-xs font-mono text-gray-400 w-12 flex-shrink-0">{task.time || '—'}</div>
                  <div className="flex-1">
                    <p className={`font-semibold ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                    <p className="text-xs text-gray-500">#{task.keyword} • {task.duration || 25} min</p>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#10B981' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
