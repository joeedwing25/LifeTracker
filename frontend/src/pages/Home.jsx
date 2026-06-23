import { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, filterTasksByDayMode } from '@/lib/db';
import { aiService } from '@/lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GiantHeading from '@/components/GiantHeading';
import { Play, Check, Sparkles, Cake, Bell, Clock as ClockIcon, Plus, X, Trash2 } from 'lucide-react';
import TaskCard from '@/components/TaskCard';
import TaskEditorSheet from '@/components/TaskEditorSheet';
import TaskSuccessPopup from '@/components/TaskSuccessPopup';
import ProductivityChart from '@/components/ProductivityChart';
import { toast } from 'sonner';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Home() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('tasks');
  const [aiSummary, setAiSummary] = useState(null);
  const [showAiBubble, setShowAiBubble] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [justAddedTask, setJustAddedTask] = useState(null);

  const today = currentTime.toISOString().split('T')[0];
  const dayName = DAYS[currentTime.getDay()];
  const monthName = MONTHS[currentTime.getMonth()];
  const date = currentTime.getDate();
  const year = currentTime.getFullYear();
  const time = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const allTodayTasks = useLiveQuery(
    () => db.tasks.where('date').equals(today).filter(t => !t.parentId).toArray(),
    [today]
  );
  const reminders = useLiveQuery(() => db.reminders.toArray());
  const birthdays = useLiveQuery(() => db.birthdays.toArray());
  const dayMode = useLiveQuery(() => db.dayModes.get(today), [today]);
  const todayJournal = useLiveQuery(() => db.journals.where('date').equals(today).first(), [today]);
  const analytics = useLiveQuery(() => db.analytics.toArray());

  // Weekly productivity data
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result = [];
    const data = analytics || [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      const dayData = data.find(a => a.date === dateStr);

      result.push({
        day: dayName,
        count: dayData?.tasksCompleted || 0,
        active: dateStr === today
      });
    }
    return result;
  }, [analytics, today]);

  // Apply sequential visibility and time-based filtering for health tasks
  const todayTasks = useMemo(() => {
    if (!allTodayTasks) return [];

    const now = currentTime;
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const oneHour = 60 * 60 * 1000;
    const nowTime = now.getTime();

    // 1. Separate Health vs Regular
    const healthTasks = allTodayTasks.filter(t => t.isHealth || t.keyword === 'health');
    const regularTasks = allTodayTasks.filter(t => !(t.isHealth || t.keyword === 'health'));

    // 2. Filter Regular Tasks (DayMode + 1-hour cleanup)
    const filteredRegular = filterTasksByDayMode(regularTasks, dayMode?.mode || 'working')
      .filter(task => {
        if (!task.completed || !task.completedAt) return true;
        return nowTime - new Date(task.completedAt).getTime() < oneHour;
      });

    // 3. Filter Health Tasks (Sequential + Time-based)
    // Group incomplete health tasks by title to find the "first incomplete" in each group
    const incompleteHealthByTitle = {};
    healthTasks.forEach(t => {
      if (!t.completed) {
        if (!incompleteHealthByTitle[t.title]) {
          incompleteHealthByTitle[t.title] = [];
        }
        incompleteHealthByTitle[t.title].push(t);
      }
    });

    // Sort each group by time
    Object.keys(incompleteHealthByTitle).forEach(title => {
      incompleteHealthByTitle[title].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    });

    const filteredHealth = healthTasks.filter(task => {
      // If completed: show if within 1 hour
      if (task.completed) {
        if (!task.completedAt) return false;
        return nowTime - new Date(task.completedAt).getTime() < oneHour;
      }

      // If not completed:
      // a) Show if its time has already passed
      const taskTime = task.time || '00:00';
      if (taskTime <= currentTimeStr) return true;

      // b) Show if it is the NEXT task in line (first incomplete for this title)
      const group = incompleteHealthByTitle[task.title];
      if (group && group[0].id === task.id) return true;

      return false;
    });

    // Combine and sort by time
    return [...filteredRegular, ...filteredHealth].sort((a, b) =>
      (a.time || '09:00').localeCompare(b.time || '09:00')
    );
  }, [allTodayTasks, dayMode, currentTime]);

  const completedTasks = todayTasks.filter(t => t.completed).length || 0;
  const totalTasks = todayTasks.length || 0;
  const dailyProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Today's birthday detection
  const todayMonthDay = `${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  const todayBirthdays = birthdays?.filter(b => b.date === todayMonthDay) || [];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Trigger AI bubble contextually (not pinned, just appears occasionally)
  useEffect(() => {
    if (allTodayTasks && allTodayTasks.length > 0 && !aiSummary) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTodayTasks?.length]);

  const handleMoodSelect = async (mood) => {
    if (todayJournal) {
      await db.journals.update(todayJournal.id, { mood });
    } else {
      await db.journals.add({
        date: today,
        mood,
        content: '',
        createdAt: new Date().toISOString()
      });
    }
    toast.success('Mood recorded');
  };

  const generateSummary = async () => {
    try {
      const summary = await aiService.generateDailySummary({
        tasksCompleted: completedTasks,
        totalTasks: totalTasks,
        focusMinutes: 0,
        productivityScore: dailyProgress,
      });
      setAiSummary(summary);
      setShowAiBubble(true);
      setTimeout(() => setShowAiBubble(false), 8000); // Auto-hide after 8s
    } catch (err) {
      setAiSummary('Stay focused. Your future self is watching.');
      setShowAiBubble(true);
      setTimeout(() => setShowAiBubble(false), 8000);
    }
  };

  const toggleTask = async (taskId, completed) => {
    await db.tasks.update(taskId, { completed: !completed });
  };

  const startFocusMode = (taskId) => {
    navigate(`/focus?taskId=${taskId}`);
  };

  const handleReschedule = (task) => {
    setEditingTask(task);
  };

  const handleDeleteTask = async (taskId) => {
    const taskToDelete = await db.tasks.get(taskId);
    if (!taskToDelete) return;

    await db.tasks.delete(taskId);

    toast("Task Deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          await db.tasks.add(taskToDelete);
          toast.success("Task restored");
        },
      },
    });
  };

  const handleUpdateTask = async (updatedTask) => {
    await db.tasks.put(updatedTask);
    setEditingTask(null);
    toast.success("Task updated");
  };

  const handleUpdateReminder = async (e) => {
    e.preventDefault();
    await db.reminders.put(editingReminder);
    setEditingReminder(null);
    toast.success("Reminder updated");
  };

  const handleTaskAdded = (task) => {
    setJustAddedTask(task);
    setTimeout(() => setJustAddedTask(null), 3000);
  };

  if (!allTodayTasks) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="home-dashboard">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0">
      {/* Header */}
      <header className="px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">TODAY</p>
        <GiantHeading className="leading-[0.9]" data-testid="giant-day-heading">{dayName}</GiantHeading>
        <p className="text-base text-gray-500 mt-2">
          {monthName} {date}, {year} — {time}
        </p>

        {/* Birthday alert - shows just below big day */}
        {todayBirthdays.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-pink-50 rounded-full border border-pink-100 w-fit"
          >
            <Cake className="w-4 h-4 text-pink-600" />
            <span className="text-sm font-semibold text-pink-700">
              {todayBirthdays.map(b => b.name).join(', ')}'s Birthday Today! 🎂
            </span>
          </motion.div>
        )}
      </header>

      {/* Daily Progress & Productivity Chart Card */}
      <div className="px-5 mb-4">
        <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-white/40" data-testid="daily-progress-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">DAILY PROGRESS</p>
              <h2 className="text-4xl font-bold leading-none">{dailyProgress}%</h2>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                <motion.circle
                  cx="32" cy="32" r="28" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - dailyProgress / 100) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold">{completedTasks}/{totalTasks}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">WEEKLY PERFORMANCE</p>
            <ProductivityChart data={weeklyData} />
          </div>
        </div>
      </div>

      {/* Mood Check-in */}
      {!todayJournal?.mood && (
        <div className="px-5 mb-4">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-[2rem] p-5 text-white shadow-lg">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-80 mb-2">MOOD CHECK-IN</p>
            <h3 className="font-bold text-lg mb-3">How are you feeling today?</h3>
            <div className="flex justify-between">
              {['😔', '😐', '🙂', '😊', '🤩'].map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => handleMoodSelect(i + 1)}
                  className="text-3xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Tasks / Reminders / Database */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { id: 'tasks', label: 'Tasks' },
            { id: 'reminders', label: 'Reminders' },
            { id: 'database', label: 'Database' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-black text-white shadow-md'
                  : 'bg-white text-gray-500'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {todayTasks.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white rounded-[2rem] p-8 text-center"
                >
                  <p className="text-gray-500">
                    {dayMode?.mode === 'leave' ? "It's a leave day. Rest well! 🌴" : "No tasks for today yet."}
                  </p>
                </motion.div>
              ) : (
                todayTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      type: 'spring',
                      damping: 25,
                      stiffness: 200,
                      delay: index * 0.05
                    }}
                  >
                    <TaskCard
                      task={task}
                      onToggle={toggleTask}
                      onDelete={handleDeleteTask}
                      onFocus={startFocusMode}
                      onReschedule={handleReschedule}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'reminders' && (
          <>
            {!reminders || reminders.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-8 text-center">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming reminders</p>
              </div>
            ) : (
              reminders.map(r => (
                <div
                  key={r.id}
                  className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-4 cursor-pointer"
                  data-testid={`reminder-${r.id}`}
                  onClick={() => setEditingReminder(r)}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.date} • {r.time} • {r.repeat}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); db.reminders.delete(r.id); }}
                    className="w-8 h-8 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'database' && (
          <div className="pb-10">
            <DatabaseTab birthdays={birthdays} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingTask && (
          <TaskEditorSheet
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={handleUpdateTask}
            onDelete={handleDeleteTask}
          />
        )}
      </AnimatePresence>

      <TaskSuccessPopup isVisible={!!justAddedTask} task={justAddedTask} />

      <AnimatePresence>
        {editingReminder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setEditingReminder(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-[430px] bg-white rounded-t-[2.5rem] p-6 max-h-[80dvh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-4">Edit Reminder</h2>
              <form onSubmit={handleUpdateReminder} className="space-y-4">
                <input
                  type="text"
                  value={editingReminder.title}
                  onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })}
                  className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-semibold"
                  placeholder="Reminder title"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={editingReminder.date}
                    onChange={(e) => setEditingReminder({ ...editingReminder, date: e.target.value })}
                    className="w-full p-3 bg-gray-100 rounded-2xl outline-none"
                  />
                  <input
                    type="time"
                    value={editingReminder.time}
                    onChange={(e) => setEditingReminder({ ...editingReminder, time: e.target.value })}
                    className="w-full p-3 bg-gray-100 rounded-2xl outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-full font-bold">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Summary Bubble - top center, NOT overlapping FAB/Mic */}
      <AnimatePresence>
        {showAiBubble && aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed left-4 z-30"
            style={{ 
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)',
              right: '6rem'  // Leave space for FAB and Mic on the right
            }}
          >
            <div className="relative cursor-pointer group" onClick={() => setShowAiBubble(false)}>
              {/* Pulsing Aura Glow behind the card */}
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -inset-1 rounded-[1.6rem] bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-blue-500/30 blur-xl animate-pulse" />

              <div className="relative bg-white/40 backdrop-blur-xl border border-white/20 rounded-[1.5rem] p-4 flex items-start gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm border border-white/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm text-gray-800 font-medium leading-relaxed line-clamp-3">{aiSummary}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Database Tab with Birthday Entry ============
function DatabaseTab({ birthdays }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [month, setMonth] = useState('01');
  const [day, setDay] = useState('01');
  const [relation, setRelation] = useState('Friends');

  const addBirthday = async () => {
    if (!name.trim()) return;
    await db.birthdays.add({
      name: name.trim(),
      date: `${month}-${day}`,
      relation,
    });
    setName(''); setShowAdd(false);
  };

  const deleteBirthday = async (id) => {
    await db.birthdays.delete(id);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-gray-500">🎂 Birthdays (Yearly reminders)</p>
        <button 
          onClick={() => setShowAdd(!showAdd)} 
          className="text-xs font-semibold text-black flex items-center gap-1"
          data-testid="add-birthday-toggle"
        >
          {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showAdd ? 'Cancel' : 'Add'}
        </button>
      </div>

      {showAdd && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-[1.75rem] p-4 shadow-sm space-y-2 mb-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Mom, Alex)"
            className="w-full p-3 bg-gray-100 rounded-2xl outline-none text-base"
            data-testid="birthday-name-input"
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="p-3 bg-gray-100 rounded-2xl outline-none text-base" data-testid="birthday-month">
              {Array.from({length: 12}, (_, i) => String(i+1).padStart(2,'0')).map(m => (
                <option key={m} value={m}>{MONTHS[parseInt(m)-1]}</option>
              ))}
            </select>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="p-3 bg-gray-100 rounded-2xl outline-none text-base" data-testid="birthday-day">
              {Array.from({length: 31}, (_, i) => String(i+1).padStart(2,'0')).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={relation} onChange={(e) => setRelation(e.target.value)} className="p-3 bg-gray-100 rounded-2xl outline-none text-base" data-testid="birthday-relation">
              <option>Family</option>
              <option>Friends</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </div>
          <button onClick={addBirthday} className="w-full py-2.5 rounded-full bg-black text-white font-semibold text-sm" data-testid="save-birthday">Save Birthday</button>
        </motion.div>
      )}

      {!birthdays || birthdays.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-8 text-center">
          <Cake className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No birthdays saved yet</p>
        </div>
      ) : (
        birthdays.map(b => (
          <div key={b.id} className="bg-white rounded-[1.75rem] p-4 shadow-sm flex items-center gap-4" data-testid={`birthday-${b.id}`}>
            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center flex-shrink-0">
              <Cake className="w-5 h-5 text-pink-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{b.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {MONTHS[parseInt(b.date.split('-')[0])-1]} {b.date.split('-')[1]} • {b.relation} • Yearly reminder
              </p>
            </div>
            <button onClick={() => deleteBirthday(b.id)} className="w-8 h-8 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4 mx-auto" />
            </button>
          </div>
        ))
      )}
    </>
  );
}
