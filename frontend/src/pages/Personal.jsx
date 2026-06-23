import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import TaskCard from '@/components/TaskCard';
import { toast } from 'sonner';
import { aiService } from '@/lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import { 
  Briefcase, Activity, Heart, X, Plus, Send, Sparkles,
  TrendingUp, Target, Droplet, Moon, Flame, Apple
} from 'lucide-react';

export default function Personal() {
  const [activeCard, setActiveCard] = useState('business');
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState(null);

  const skills = useLiveQuery(() => db.skills.toArray()) || [];
  const health = useLiveQuery(() => db.health.get('main'));
  const business = useLiveQuery(() => db.business.toArray()) || [];

  const CARDS = [
    {
      id: 'business',
      label: 'Business',
      icon: Briefcase,
      signals: business.length,
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: Activity,
      signals: skills.length,
    },
    {
      id: 'health',
      label: 'Health',
      icon: Heart,
      signals: health ? 1 : 0,
    },
  ];

  const openPopup = (cardId) => {
    setActiveCard(cardId);
    setPopupContent(cardId);
    setShowPopup(true);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="personal-page">
      <div className="flex-shrink-0 px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">YOU</p>
        <GiantHeading className="leading-[0.9]">PERSONAL</GiantHeading>
        <p className="text-sm text-gray-500 mt-2">Health is ready when you are. Start with one simple update.</p>
      </div>

      {/* Top Cards */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {CARDS.map(card => {
            const Icon = card.icon;
            const isActive = activeCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => openPopup(card.id)}
                data-testid={`personal-card-${card.id}`}
                className={`p-5 rounded-[1.75rem] transition-all text-left ${
                  isActive 
                    ? 'bg-black text-white shadow-lg scale-105' 
                    : 'bg-white text-gray-900 shadow-sm hover:shadow-md'
                }`}
              >
                <Icon className="w-6 h-6 mb-3" />
                <p className="font-bold text-base">{card.label}</p>
                <p className={`text-xs mt-1 ${isActive ? 'text-white/60' : 'text-gray-500'}`}>
                  {card.signals} signals
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Section - Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-40 scrollbar-hide">
        {activeCard === 'business' && (
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/60">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">BUSINESS & ANALYTICS</p>
            <p className="text-2xl font-bold leading-tight mb-6">
              Track dreams, ventures, income signals, execution, and roadmap movement without turning ambition into noise.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">VENTURES</p>
                <p className="text-2xl font-bold mt-1">{business.filter(b => b.type === 'venture').length}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">INCOME</p>
                <p className="text-2xl font-bold mt-1">₹{business.filter(b => b.type === 'income').reduce((s, b) => s + (b.amount || 0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">ROADMAP</p>
                <p className="text-2xl font-bold mt-1">0</p>
              </div>
            </div>
            <button onClick={() => openPopup('business')} className="mt-4 w-full py-3 rounded-full bg-black text-white font-semibold text-sm" data-testid="open-business-detail">
              Open Business Dashboard →
            </button>
          </div>
        )}

        {activeCard === 'skills' && (
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/60">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">ACADEMICS & SKILLS</p>
            <p className="text-2xl font-bold leading-tight mb-6">
              Map proficiency, log progress, identify weak areas — without overwhelming yourself.
            </p>
            <div className="space-y-3">
              {skills.slice(0, 3).map(skill => (
                <div key={skill.id} className="bg-gray-50 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{skill.name}</span>
                    <span className="text-xs text-gray-500">{skill.proficiency}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${skill.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => openPopup('skills')} className="mt-4 w-full py-3 rounded-full bg-black text-white font-semibold text-sm" data-testid="open-skills-detail">
              Open Skills Dashboard →
            </button>
          </div>
        )}

        {activeCard === 'health' && (
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/60">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">HEALTH</p>
            <p className="text-2xl font-bold leading-tight mb-6">
              Track weight, sleep, water, calories, workouts — all in one calm space.
            </p>
            {health && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">WEIGHT</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-700">{health.weight} kg</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Goal: {health.targetWeight} kg</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">WATER</p>
                  <p className="text-2xl font-bold mt-1 text-blue-700">{health.waterIntake}L</p>
                  <p className="text-xs text-blue-600 mt-0.5">Today</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-purple-600 font-bold">SLEEP</p>
                  <p className="text-2xl font-bold mt-1 text-purple-700">{health.sleep}h</p>
                  <p className="text-xs text-purple-600 mt-0.5">Last night</p>
                </div>
                <div className="bg-orange-50 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-orange-600 font-bold">CALORIES</p>
                  <p className="text-2xl font-bold mt-1 text-orange-700">{health.calories}</p>
                  <p className="text-xs text-orange-600 mt-0.5">Daily intake</p>
                </div>
              </div>
            )}
            <button onClick={() => openPopup('health')} className="mt-4 w-full py-3 rounded-full bg-black text-white font-semibold text-sm" data-testid="open-health-detail">
              Open Health Dashboard →
            </button>
          </div>
        )}
      </div>

      {/* Detail Popup */}
      <AnimatePresence>
        {showPopup && (
          <DetailPopup type={popupContent} onClose={() => setShowPopup(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Detail Popup Component ============
function DetailPopup({ type, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-0 left-0 right-0 mx-auto max-w-[430px] bg-white rounded-t-[2.5rem] max-h-[88dvh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}
        data-testid="detail-popup"
      >
        <div className="sticky top-0 bg-white pt-4 pb-3 px-6 border-b border-gray-100">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold capitalize">{type}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" data-testid="popup-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {type === 'health' && <HealthDetail />}
          {type === 'skills' && <SkillsDetail />}
          {type === 'business' && <BusinessDetail />}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Health Detail ============
function HealthDetail() {
  const health = useLiveQuery(() => db.health.get('main'));
  const today = new Date().toISOString().split('T')[0];
  const todayHealthTasks = useLiveQuery(
    () => db.tasks.where('date').equals(today).and(t => t.isHealth || t.keyword === 'health').toArray(),
    [today]
  ) || [];

  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({});
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    if (health) setData(health);
  }, [health]);
  const [taskTitle, setTaskTitle] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [reminderTimes, setReminderTimes] = useState(['08:00']);

  const save = async () => {
    await db.health.put({ id: 'main', ...data });
    setEditing(false);
  };

  const toggleTask = async (taskId, completed) => {
    await db.tasks.update(taskId, { completed: !completed });
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

  const addHealthTask = async () => {
    if (!taskTitle.trim()) return;
    const today = new Date().toISOString().split('T')[0];

    const tasksToAdd = reminderTimes.slice(0, repeatCount).map(time => ({
      title: taskTitle.trim(),
      date: today,
      time: time,
      completed: false,
      keyword: 'health',
      priority: 'medium',
      repeat: 'daily',
      isHealth: true,
      duration: 30,
      createdAt: new Date().toISOString()
    }));

    await db.tasks.bulkAdd(tasksToAdd);
    setTaskTitle('');
    setShowAddTask(false);
    setRepeatCount(1);
    setReminderTimes(['08:00']);
    toast.success(`${tasksToAdd.length} health tasks created`);
  };

  if (editing) {
    return (
      <div className="space-y-3">
        {[
          ['weight', 'Weight (kg)'],
          ['targetWeight', 'Target Weight (kg)'],
          ['height', 'Height (cm)'],
          ['waterIntake', 'Water (L)'],
          ['sleep', 'Sleep (h)'],
          ['calories', 'Calories'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</label>
            <input
              type="number"
              value={data[key] || ''}
              onChange={(e) => setData({ ...data, [key]: parseFloat(e.target.value) || 0 })}
              className="w-full p-3 bg-gray-100 rounded-2xl outline-none mt-1"
              data-testid={`health-input-${key}`}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-full bg-gray-100 font-semibold">Cancel</button>
          <button onClick={save} className="flex-1 py-3 rounded-full bg-black text-white font-semibold" data-testid="save-health">Save</button>
        </div>
      </div>
    );
  }

  const healthData = health || {};

  return (
    <div className="space-y-4">
      {/* Today's Schedule Section */}
      {todayHealthTasks.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">TODAY'S SCHEDULE</p>
          <div className="space-y-2">
            {todayHealthTasks.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')).map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onDelete={handleDeleteTask}
                onReschedule={() => {}} // Personal section maybe doesn't need reschedule here
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'weight', label: 'Weight', unit: 'kg', icon: TrendingUp, color: 'emerald' },
          { key: 'targetWeight', label: 'Target', unit: 'kg', icon: Target, color: 'emerald' },
          { key: 'waterIntake', label: 'Water', unit: 'L', icon: Droplet, color: 'blue' },
          { key: 'sleep', label: 'Sleep', unit: 'h', icon: Moon, color: 'purple' },
          { key: 'calories', label: 'Calories', unit: '', icon: Flame, color: 'orange' },
          { key: 'height', label: 'Height', unit: 'cm', icon: Apple, color: 'green' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.key} className={`bg-${item.color}-50 rounded-2xl p-4`}>
              <Icon className={`w-5 h-5 text-${item.color}-600 mb-2`} />
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{item.label}</p>
              <p className={`text-2xl font-bold mt-0.5 text-${item.color}-700`}>{healthData[item.key] || 0} <span className="text-sm">{item.unit}</span></p>
            </div>
          );
        })}
      </div>
      <button onClick={() => { setData(healthData); setEditing(true); }} className="w-full py-3 rounded-full bg-black text-white font-semibold" data-testid="edit-health">
        Update Health Stats
      </button>

      {/* Add Health Task (auto-repeating, green bg) */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-green-700 font-bold">HEALTH TASK</p>
            <p className="text-sm text-gray-600">Auto-repeating, shows green on Home</p>
          </div>
          <button 
            onClick={() => setShowAddTask(!showAddTask)} 
            className="px-4 py-2 rounded-full bg-green-600 text-white text-xs font-semibold"
            data-testid="add-health-task-toggle"
          >
            {showAddTask ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showAddTask && (
          <div className="mt-3 space-y-3">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Workout, Drink water, Stretch"
              className="w-full p-3 bg-white rounded-2xl outline-none text-sm border border-gray-100"
              data-testid="health-task-title"
            />

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Repeat Count</label>
              <select
                value={repeatCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setRepeatCount(val);
                  if (reminderTimes.length < val) {
                    const extra = Array(val - reminderTimes.length).fill('12:00');
                    setReminderTimes([...reminderTimes, ...extra]);
                  }
                }}
                className="w-full p-3 bg-white rounded-2xl outline-none text-sm border border-gray-100"
                data-testid="health-task-repeat-count"
              >
                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} times per day</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Reminder Times</label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: repeatCount }).map((_, i) => (
                  <input
                    key={i}
                    type="time"
                    value={reminderTimes[i] || '08:00'}
                    onChange={(e) => {
                      const newTimes = [...reminderTimes];
                      newTimes[i] = e.target.value;
                      setReminderTimes(newTimes);
                    }}
                    className="p-2.5 bg-white rounded-xl outline-none text-xs border border-gray-100"
                  />
                ))}
              </div>
            </div>

            <button 
              onClick={addHealthTask} 
              className="w-full py-3.5 rounded-full bg-black text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
              data-testid="save-health-task"
            >
              Add Health Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Skills Detail ============
function SkillsDetail() {
  const skills = useLiveQuery(() => db.skills.toArray()) || [];
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [newSkill, setNewSkill] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const skillEntries = useLiveQuery(
    () => selectedSkill ? db.skillEntries.where('skillId').equals(selectedSkill.id).toArray() : [],
    [selectedSkill?.id]
  ) || [];

  const addSkill = async () => {
    if (!newSkill.trim()) return;
    await db.skills.add({
      name: newSkill,
      keyword: 'general',
      proficiency: 'Beginner',
      progress: 5,
      lastPracticed: new Date().toISOString().split('T')[0]
    });
    setNewSkill('');
  };

  const sendSkillUpdate = async () => {
    if (!chatMessage.trim() || !selectedSkill) return;
    setLoading(true);

    await db.skillEntries.add({
      skillId: selectedSkill.id,
      timestamp: new Date().toISOString(),
      content: chatMessage,
    });

    try {
      const response = await aiService.analyzeSkill(selectedSkill.name, [...skillEntries, { content: chatMessage }]);
      setChatHistory([...chatHistory, 
        { role: 'user', text: chatMessage }, 
        { role: 'ai', text: response }
      ]);
      
      // Increase progress slightly
      await db.skills.update(selectedSkill.id, {
        progress: Math.min(100, (selectedSkill.progress || 0) + 5),
        lastPracticed: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      setChatHistory([...chatHistory, { role: 'user', text: chatMessage }, { role: 'ai', text: 'Got it! Keep going.' }]);
    }
    setChatMessage('');
    setLoading(false);
  };

  if (selectedSkill) {
    return (
      <div>
        <button onClick={() => setSelectedSkill(null)} className="text-sm text-gray-500 mb-4">← Back to skills</button>
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-4 mb-4">
          <h3 className="text-2xl font-bold">{selectedSkill.name}</h3>
          <p className="text-sm text-gray-600">{selectedSkill.proficiency} • {selectedSkill.progress}% progress</p>
        </div>

        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-black text-white ml-8' : 'bg-gray-100 mr-8'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendSkillUpdate()}
            placeholder="I learned arrays today..."
            className="flex-1 p-3 bg-gray-100 rounded-full outline-none text-sm"
            data-testid="skill-chat-input"
          />
          <button onClick={sendSkillUpdate} disabled={loading} className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center" data-testid="skill-chat-send">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          placeholder="Add a new skill (e.g. Python)"
          className="flex-1 p-3 bg-gray-100 rounded-full outline-none text-sm"
          data-testid="new-skill-input"
        />
        <button onClick={addSkill} className="px-5 py-3 rounded-full bg-black text-white font-semibold text-sm" data-testid="add-skill-button">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {skills.map(skill => (
          <button
            key={skill.id}
            onClick={() => setSelectedSkill(skill)}
            className="w-full bg-gray-50 rounded-2xl p-4 text-left hover:bg-gray-100 transition-colors"
            data-testid={`skill-${skill.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">{skill.name}</h3>
              <span className="text-xs text-gray-500">{skill.proficiency}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${skill.progress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Tap to chat & log progress →</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ Business Detail ============
function BusinessDetail() {
  const business = useLiveQuery(() => db.business.toArray()) || [];
  const roadmaps = useLiveQuery(() => db.roadmaps.toArray()) || [];
  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [keyword, setKeyword] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const totalIncome = business.filter(b => b.type === 'income').reduce((s, b) => s + (b.amount || 0), 0);
  
  // Auto-pull business/career roadmaps and their progress
  const businessRoadmaps = roadmaps.filter(r => 
    ['business', 'career', 'startup'].includes(r.keyword?.toLowerCase())
  );

  const addIncome = async () => {
    if (!keyword.trim() || !amount) return;
    await db.business.add({
      type: 'income',
      amount: parseFloat(amount) || 0,
      date: new Date().toISOString().split('T')[0],
      keyword,
      notes: ''
    });
    setKeyword(''); setAmount(''); setShowAdd(false);
  };

  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    setLoading(true);
    try {
      const response = await aiService.businessAdvisor(aiQuestion, { 
        income: totalIncome, 
        roadmaps: businessRoadmaps.length,
        tasksCompleted: allTasks.filter(t => t.completed && businessRoadmaps.some(r => r.id === t.roadmapId)).length
      });
      setAiResponse(response);
    } catch (e) {
      setAiResponse('Unable to analyze right now.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Income (manual entry) */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-600 font-bold">TOTAL REVENUE</p>
            <p className="text-3xl font-bold text-purple-700">₹{totalIncome.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)} 
            className="px-4 py-2 rounded-full bg-purple-600 text-white text-xs font-semibold"
            data-testid="add-business-toggle"
          >
            {showAdd ? 'Cancel' : '+ Add Revenue'}
          </button>
        </div>

        {showAdd && (
          <div className="mt-3 space-y-2">
            <input 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Source (e.g. Client X, YouTube)" 
              className="w-full p-3 bg-white rounded-2xl outline-none text-sm" 
              data-testid="business-keyword-input"
            />
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="Amount (₹)" 
              className="w-full p-3 bg-white rounded-2xl outline-none text-sm" 
              data-testid="business-amount-input" 
            />
            <button onClick={addIncome} className="w-full py-3 rounded-full bg-black text-white font-semibold text-sm" data-testid="save-business">
              Save Revenue
            </button>
          </div>
        )}
      </div>

      {/* Connected Roadmaps */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">CONNECTED ROADMAPS</p>
        {businessRoadmaps.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-500">Create a Business or Career roadmap to track progress here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {businessRoadmaps.map(r => {
              const roadmapTasks = allTasks.filter(t => t.roadmapId === r.id);
              const completed = roadmapTasks.filter(t => t.completed).length;
              const progress = roadmapTasks.length > 0 ? Math.round((completed / roadmapTasks.length) * 100) : 0;
              return (
                <div key={r.id} className="bg-gray-50 rounded-2xl p-3" data-testid={`business-roadmap-${r.id}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm">{r.title}</span>
                    <span className="text-xs font-bold" style={{ color: r.color }}>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden">
                    <div className="h-full" style={{ backgroundColor: r.color, width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">{completed}/{roadmapTasks.length} tasks done</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Advisor */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <p className="text-xs font-bold text-purple-700">AI BUSINESS ADVISOR</p>
        </div>
        <div className="flex gap-2">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="Ask: How to grow income?"
            className="flex-1 p-3 bg-white rounded-full outline-none text-sm"
            data-testid="business-ai-input"
          />
          <button onClick={askAI} disabled={loading} className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center" data-testid="business-ai-ask">
            <Send className="w-4 h-4" />
          </button>
        </div>
        {aiResponse && (
          <div className="mt-3 p-3 bg-white rounded-2xl text-sm whitespace-pre-wrap">{aiResponse}</div>
        )}
      </div>
    </div>
  );
}
