import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  ArrowLeft, Pencil, Plus, ChevronRight, ChevronDown, Trash2, Check,
  Brain, ListChecks, FileText, GripVertical, Sparkles
} from 'lucide-react';
import TaskCard from '@/components/TaskCard';
import TaskEditorSheet from '@/components/TaskEditorSheet';
import TaskSuccessPopup from '@/components/TaskSuccessPopup';
import { toast } from 'sonner';

const REPEAT_OPTIONS = ['No Repeat', 'Daily', 'Weekly', 'Monthly'];

export default function RoadmapDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const roadmapId = parseInt(id);
  const [activeTab, setActiveTab] = useState('milestones');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [justAddedTask, setJustAddedTask] = useState(null);

  const roadmap = useLiveQuery(() => !isNaN(roadmapId) ? db.roadmaps.get(roadmapId) : null, [roadmapId]);
  const plans = useLiveQuery(
    () => !isNaN(roadmapId) ? db.plans.where('roadmapId').equals(roadmapId).sortBy('order') : [],
    [roadmapId],
    []
  );

  // Migration logic: convert old milestones to new plans if none exist
  useEffect(() => {
    if (isNaN(roadmapId)) return;

    const migrate = async () => {
      const p = await db.plans.where('roadmapId').equals(roadmapId).toArray();
      if (p.length === 0) {
        const oldMilestones = await db.milestones.where('roadmapId').equals(roadmapId).toArray();
        if (oldMilestones.length > 0) {
          const newPlans = oldMilestones.map((m, i) => ({
            id: m.id,
            roadmapId: m.roadmapId,
            name: m.title,
            done: m.status === 'completed',
            order: i,
            createdAt: new Date().toISOString()
          }));
          await db.plans.bulkAdd(newPlans);
        }
      }
    };
    migrate();
  }, [roadmapId]);

  const tasksLive = useLiveQuery(() => !isNaN(roadmapId) ? db.tasks.where('roadmapId').equals(roadmapId).filter(t => !t.parentId).toArray() : [], [roadmapId]);
  const tasks = useMemo(() => tasksLive || [], [tasksLive]);

  const filesLive = useLiveQuery(() => !isNaN(roadmapId) ? db.files.where('roadmapId').equals(roadmapId).toArray() : [], [roadmapId]);
  const files = useMemo(() => filesLive || [], [filesLive]);

  // Group tasks by planId
  const tasksByPlan = useMemo(() => {
    const grouped = { loose: [] };
    if (!tasks) return grouped;
    tasks.forEach(task => {
      if (task.planId) {
        if (!grouped[task.planId]) grouped[task.planId] = [];
        grouped[task.planId].push(task);
      } else {
        grouped.loose.push(task);
      }
    });
    return grouped;
  }, [tasks]);

  // Calculate roadmap progress based on completed tasks
  const allTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const overallProgress = allTasksCount > 0 ? Math.round((completedTasksCount / allTasksCount) * 100) : 0;

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

  const handleTaskAdded = (task) => {
    setJustAddedTask(task);
    setTimeout(() => setJustAddedTask(null), 3000);
  };

  if (!roadmap) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" /></div>;
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="roadmap-detail-page">
      {/* Fixed Top Section */}
      <div className="flex-shrink-0">
      {/* Header */}
      <div className="px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <button
          onClick={() => navigate('/roadmaps')}
          className="flex items-center gap-2 text-gray-600 mb-4 text-sm font-medium"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          Roadmaps
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: roadmap.color }} />
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold">#{roadmap.keyword}</p>
            </div>
            {editingTitle ? (
              <input
                defaultValue={roadmap.title}
                className="text-4xl font-black tracking-tight bg-transparent border-b-2 border-black outline-none w-full"
                onBlur={async (e) => {
                  const newTitle = e.target.value.trim();
                  if (newTitle && newTitle !== roadmap.title) {
                    await db.roadmaps.update(roadmapId, { title: newTitle });
                    toast.success('Title updated');
                  }
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                autoFocus
              />
            ) : (
              <h1 className="text-4xl font-black tracking-tight">{roadmap.title}</h1>
            )}
          </div>
          <button
            onClick={() => setEditingTitle(true)}
            className="text-sm font-semibold text-gray-600 px-4 py-1.5"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="px-5 mb-4">
        <div className="bg-white/80 backdrop-blur-md rounded-[1.75rem] p-5 shadow-sm border border-white/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold">PROGRESS</p>
            <p className="text-2xl font-black">{overallProgress}%</p>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
            <motion.div
              className="h-full"
              style={{ backgroundColor: roadmap.color }}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <p className="text-xs text-gray-500">Due {roadmap.dueDate}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-6">
        <div className="flex gap-2">
          {[
            { id: 'timeline', label: 'Timeline', icon: Brain },
            { id: 'milestones', label: 'Milestones', icon: ListChecks },
            { id: 'files', label: 'Files', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id ? 'bg-black text-white' : 'bg-white text-gray-600'
                }`}
                data-testid={`roadmap-tab-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      </div>

      {/* Tab Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        {activeTab === 'timeline' && (
          <TimelineTab roadmap={roadmap} plans={plans} overallProgress={overallProgress} tasksByPlan={tasksByPlan} />
        )}

        {activeTab === 'milestones' && (
          <MilestonesTab
            roadmapId={roadmapId}
            roadmap={roadmap}
            plans={plans}
            tasksByPlan={tasksByPlan}
            onToggleTask={toggleTask}
            onDeleteTask={handleDeleteTask}
            onFocusTask={startFocusMode}
            onRescheduleTask={handleReschedule}
            onTaskAdded={handleTaskAdded}
          />
        )}

        {activeTab === 'files' && (
          <FilesTab roadmapId={roadmapId} files={files} />
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
    </div>
  );
}

// ============ Milestones Tab (New Style) ============
function MilestonesTab({
  roadmapId, roadmap, plans, tasksByPlan,
  onToggleTask, onDeleteTask, onFocusTask, onRescheduleTask,
  onTaskAdded
}) {
  const [newPlanName, setNewPlanName] = useState('');

  const addPlan = async () => {
    if (!newPlanName.trim()) return;
    await db.plans.add({
      roadmapId,
      name: newPlanName.trim(),
      done: false,
      order: plans.length,
      createdAt: new Date().toISOString()
    });
    setNewPlanName('');
  };

  const reorderPlans = async (newPlans) => {
    // We update orders in DB
    for (let i = 0; i < newPlans.length; i++) {
      if (newPlans[i].order !== i) {
        await db.plans.update(newPlans[i].id, { order: i });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new milestone */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-2">
        <input
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
          placeholder="New milestone name..."
          className="flex-1 p-3 bg-gray-50 rounded-2xl outline-none text-sm"
          data-testid="new-milestone-input"
        />
        <button
          onClick={addPlan}
          className="px-6 py-3 rounded-full bg-black text-white font-semibold text-sm whitespace-nowrap"
          data-testid="add-milestone-button"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add
        </button>
      </div>

      {/* Plans list */}
      <Reorder.Group axis="y" values={plans} onReorder={reorderPlans} className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            tasks={tasksByPlan[plan.id] || []}
            roadmapId={roadmapId}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onFocusTask={onFocusTask}
            onRescheduleTask={onRescheduleTask}
            onTaskAdded={onTaskAdded}
          />
        ))}
      </Reorder.Group>

      {/* Quick Tasks Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gray-200" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold">QUICK TASKS</p>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <QuickTaskAdd roadmapId={roadmapId} onTaskAdded={onTaskAdded} />
        <div className="mt-3 space-y-2">
          <AnimatePresence mode="popLayout">
            {tasksByPlan.loose?.map((task, index) => (
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
                  onToggle={onToggleTask}
                  onDelete={onDeleteTask}
                  onFocus={onFocusTask}
                  onReschedule={onRescheduleTask}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============ Timeline Tab ============
function TimelineTab({ roadmap, plans, overallProgress, tasksByPlan }) {
  const nextStep = plans.length > 0 ? plans[0].name : 'Phase complete. Ready for new goals.';

  return (
    <div className="space-y-4">
      {/* Big Hero Card */}
      <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-[2rem] p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold">ROADMAP OVERVIEW</p>
            <h2 className="text-2xl font-bold mt-0.5">{roadmap.title}</h2>
          </div>
        </div>
        <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold mb-1">NEXT STEP</p>
            <p className="text-sm font-semibold">{nextStep}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold mb-1">OVERALL PROGRESS</p>
            <p className="text-3xl font-black">{overallProgress}% <span className="text-xs font-normal text-white/60">DONE</span></p>
          </div>
        </div>
      </div>

      {/* Phases / Plans */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-[1.75rem] p-8 text-center border-2 border-dashed border-gray-200">
          <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Go to Milestones tab to add plans.</p>
        </div>
      ) : (
        plans.map((plan, index) => {
          const planTasks = tasksByPlan[plan.id] || [];
          const done = planTasks.filter(t => t.completed).length;
          const pct = planTasks.length > 0 ? Math.round((done / planTasks.length) * 100) : 0;

          return (
            <div key={plan.id} className="bg-white rounded-[1.75rem] p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold">PHASE {index + 1}</p>
              <div className="flex items-center justify-between mt-1">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="text-right">
                  <p className="text-xl font-bold">{pct}%</p>
                  <p className="text-[10px] text-gray-500">{plan.done ? 'Completed' : 'Active'}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============ Plan Card with expand/collapse ============
function PlanCard({
  plan, tasks, roadmapId,
  onToggleTask, onDeleteTask, onFocusTask, onRescheduleTask,
  onTaskAdded
}) {
  const [expanded, setExpanded] = useState(false);
  const completed = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const toggleDone = async () => {
    await db.plans.update(plan.id, { done: !plan.done });
  };

  const deletePlan = async () => {
    if (confirm('Delete this milestone and all its tasks?')) {
      await db.plans.delete(plan.id);
      // Delete tasks associated with this plan
      const taskIds = tasks.map(t => t.id);
      await db.tasks.bulkDelete(taskIds);
    }
  };

  return (
    <Reorder.Item value={plan} className="bg-white/80 backdrop-blur-sm rounded-[1.5rem] p-4 shadow-sm border border-white/60" data-testid={`plan-${plan.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={toggleDone}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            plan.done ? 'bg-black border-black text-white' : 'border-gray-300'
          }`}
          data-testid={`plan-check-${plan.id}`}
        >
          {plan.done && <Check className="w-3 h-3" />}
        </button>
        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          <span className={`font-bold truncate ${plan.done ? 'line-through text-gray-400' : ''}`}>{plan.name}</span>
        </button>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400">{progress}%</p>
          <p className="text-[10px] text-gray-400">{completed}/{tasks.length}</p>
        </div>
        <button onClick={deletePlan} className="text-gray-400 hover:text-red-500 ml-2" data-testid={`delete-plan-${plan.id}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-gray-100">
              <TaskAddRow planId={plan.id} roadmapId={roadmapId} onTaskAdded={onTaskAdded} />
              <div className="mt-2 space-y-2">
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-gray-400 text-center py-2"
                    >
                      No tasks under this plan.
                    </motion.p>
                  ) : (
                    tasks.map((task, index) => (
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
                          onToggle={onToggleTask}
                          onDelete={onDeleteTask}
                          onFocus={onFocusTask}
                          onReschedule={onRescheduleTask}
                        />
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ============ Task Add Row (inline) ============
function TaskAddRow({ planId, roadmapId, onTaskAdded }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [repeat, setRepeat] = useState('No Repeat');

  const add = async () => {
    if (!title.trim()) return;
    const newTask = {
      title: title.trim(),
      date: date || null,
      time: null,
      completed: false,
      roadmapId,
      planId,
      keyword: 'general',
      priority: 'medium',
      repeat: repeat.toLowerCase().replace(' ', '-'),
      isHealth: false,
      createdAt: new Date().toISOString()
    };
    const id = await db.tasks.add(newTask);
    onTaskAdded?.({ ...newTask, id });
    setTitle('');
  };

  return (
    <div className="flex gap-1.5 items-center mt-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Add"
        className="flex-[1.2] min-w-0 p-2.5 bg-gray-50 rounded-2xl outline-none text-xs"
        data-testid={`plan-task-input-${planId}`}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="flex-1 min-w-0 p-2.5 bg-gray-50 rounded-2xl outline-none text-xs"
        placeholder="No date"
      />
      <select
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        className="p-2.5 bg-gray-50 rounded-2xl outline-none text-xs"
      >
        {REPEAT_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
      </select>
      <button
        onClick={add}
        className="px-3 py-2.5 rounded-2xl bg-black text-white font-semibold text-xs flex-shrink-0"
        data-testid={`plan-task-add-${planId}`}
      >
        Add
      </button>
    </div>
  );
}

// ============ Quick Task Add ============
function QuickTaskAdd({ roadmapId, onTaskAdded }) {
  return <TaskAddRow planId={null} roadmapId={roadmapId} onTaskAdded={onTaskAdded} />;
}

// ============ Files Tab ============
function FilesTab({ roadmapId, files }) {
  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <div className="bg-white rounded-[1.75rem] p-8 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No files attached to this roadmap.</p>
          <p className="text-xs text-gray-400 mt-1">Upload files from the Files page and link to this roadmap.</p>
        </div>
      ) : (
        files.map(file => (
          <div key={file.id} className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-500" />
            <span className="font-semibold flex-1 truncate">{file.name}</span>
          </div>
        ))
      )}
    </div>
  );
}
