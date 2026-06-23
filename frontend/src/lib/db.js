import Dexie from 'dexie';

export const db = new Dexie('LifeOS');

db.version(6).stores({
  tasks: '++id, title, date, time, completed, roadmapId, planId, parentId, keyword, repeat, priority, deadline, isHealth, createdAt',
  roadmaps: '++id, title, keyword, dueDate, progress, color, createdAt',
  milestones: '++id, roadmapId, title, progress, startDate, endDate',
  plans: '++id, roadmapId, name, done, order, createdAt',
  habits: '++id, title, keyword, frequency, streak, lastCompleted',
  streaks: 'date, completed',
  analytics: 'date, productivityScore, focusMinutes, tasksCompleted',
  journals: '++id, date, content, mood',
  files: '++id, name, type, size, roadmapId, uploadedAt, data, analysis, cipher, iv, integratedAt',
  focusSessions: '++id, startTime, endTime, taskId, duration',
  settings: 'id, darkMode, notifications, aiProvider',
  aiChats: '++id, timestamp, sessionId, role, message',
  dayModes: 'date, mode',
  birthdays: '++id, name, date, relation',
  reminders: '++id, title, date, time, repeat, notes',
  skills: '++id, name, keyword, proficiency, progress, lastPracticed',
  skillEntries: '++id, skillId, timestamp, content',
  health: 'id, weight, height, age, targetWeight, waterIntake, sleep, calories',
  business: '++id, type, amount, date, keyword, notes',
}).upgrade(async (tx) => {
  // Migration from version 4 to 5: Rename 'category' to 'keyword' in all affected tables
  const storesToMigrate = ['tasks', 'roadmaps', 'habits', 'skills', 'business'];
  for (const storeName of storesToMigrate) {
    await tx.table(storeName).toCollection().modify(obj => {
      if (obj.category !== undefined) {
        obj.keyword = obj.category;
        delete obj.category;
      }
    });
  }
});

// Module-level singleton to prevent duplicate initialization under React StrictMode
let _initPromise = null;

export const initializeAppData = () => {
  if (!_initPromise) {
    _initPromise = _doInitializeAppData();
  }
  return _initPromise;
};

const _doInitializeAppData = async () => {
  const settings = await db.settings.get('main');
  if (!settings) {
    await db.settings.add({
      id: 'main',
      notifications: true,
      aiProvider: 'groq',
      biometric: false,
      passcode: null,
      activeSession: null,
    });
    console.log('✅ App settings initialized');
  }
};

export const updateActiveSession = async (session) => {
  await db.settings.update('main', { activeSession: session });
};

export const clearActiveSession = async () => {
  await db.settings.update('main', { activeSession: null });
};

export const completeFocusSession = async (sessionStartTime, duration) => {
  await clearActiveSession();

  if (sessionStartTime) {
    await db.focusSessions.add({
      startTime: sessionStartTime,
      endTime: new Date().toISOString(),
      duration: duration,
    });

    // Update analytics
    const today = new Date().toISOString().split('T')[0];
    const todayAnalytics = await db.analytics.where('date').equals(today).first();

    if (todayAnalytics) {
      await db.analytics.update(todayAnalytics.id, {
        focusMinutes: (todayAnalytics.focusMinutes || 0) + duration
      });
    } else {
      await db.analytics.add({
        date: today,
        focusMinutes: duration,
        productivityScore: 0,
        tasksCompleted: 0
      });
    }
  }

  // Show completion notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus Session Complete! 🎉', {
      body: `You completed a ${duration} minute focus session.`,
      icon: '/logo192.png'
    });
  }
};

export const resetAllData = async () => {
  await db.tasks.clear();
  await db.roadmaps.clear();
  await db.milestones.clear();
  await db.plans.clear();
  await db.habits.clear();
  await db.streaks.clear();
  await db.analytics.clear();
  await db.journals.clear();
  await db.files.clear();
  await db.focusSessions.clear();
  await db.settings.clear();
  await db.aiChats.clear();
  await db.dayModes.clear();
  await db.birthdays.clear();
  await db.reminders.clear();
  await db.skills.clear();
  await db.skillEntries.clear();
  await db.health.clear();
  await db.business.clear();

  _initPromise = null;
  await db.settings.add({
    id: 'main',
    notifications: true,
    aiProvider: 'groq',
    biometric: false,
    passcode: null,
    activeSession: null,
  });
  console.log('🗑️ All data reset');
};

// Helper: Apply day mode filter to tasks
export const filterTasksByDayMode = (tasks, mode) => {
  if (mode === 'working') return tasks;
  if (mode === 'leave') {
    // Keep only 2 high-priority morning/late-night tasks
    return tasks
      .filter(t => t.priority === 'high')
      .slice(0, 2);
  }
  if (mode === 'semi-work') {
    // Remove half (lowest priority first)
    const sorted = [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] || 1) - (order[b.priority] || 1);
    });
    return sorted.slice(0, Math.ceil(sorted.length / 2));
  }
  return tasks;
};

// Plan CRUD helpers
export const putPlan = (plan) => db.plans.put(plan);
export const delPlan = (id) => db.plans.delete(id);
export const getPlansByRoadmap = (roadmapId) => db.plans.where('roadmapId').equals(roadmapId).toArray();

export const syncRoadmapProgress = async (roadmapId) => {
  if (!roadmapId) return;
  const tasks = await db.tasks.where('roadmapId').equals(roadmapId).toArray();
  if (tasks.length === 0) {
    await db.roadmaps.update(roadmapId, { progress: 0 });
    return;
  }
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);
  await db.roadmaps.update(roadmapId, { progress });
};

// Register hooks for automatic progress syncing
db.tasks.hook('creating', (primKey, obj) => {
  if (obj.roadmapId) {
    // Need to wait for the record to be created
    setTimeout(() => syncRoadmapProgress(obj.roadmapId), 100);
  }
});

db.tasks.hook('updating', (mods, primKey, obj) => {
  // Homepage Auto-Cleanup: Set completedAt when task is marked completed
  if (mods.completed === true) {
    mods.completedAt = new Date().toISOString();

    // Update analytics
    const date = obj.date || new Date().toISOString().split('T')[0];
    db.analytics.get(date).then(existing => {
      if (existing) {
        db.analytics.update(date, { tasksCompleted: existing.tasksCompleted + 1 });
      } else {
        db.analytics.add({ date, tasksCompleted: 1, productivityScore: 0, focusMinutes: 0 });
      }
    });

  } else if (mods.completed === false) {
    mods.completedAt = null;

    // Update analytics (decrement)
    const date = obj.date || new Date().toISOString().split('T')[0];
    db.analytics.get(date).then(existing => {
      if (existing && existing.tasksCompleted > 0) {
        db.analytics.update(date, { tasksCompleted: existing.tasksCompleted - 1 });
      }
    });
  }

  if (obj.roadmapId || mods.roadmapId) {
    setTimeout(() => {
      syncRoadmapProgress(obj.roadmapId);
      if (mods.roadmapId && mods.roadmapId !== obj.roadmapId) {
        syncRoadmapProgress(mods.roadmapId);
      }
    }, 100);
  }
});

db.tasks.hook('deleting', (primKey, obj) => {
  if (obj.roadmapId) {
    setTimeout(() => syncRoadmapProgress(obj.roadmapId), 100);
  }
});

export const uid = () =>
  (crypto?.randomUUID && crypto.randomUUID()) ||
  Math.random().toString(36).slice(2) + Date.now().toString(36);
