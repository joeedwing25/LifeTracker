// Notification + reminder engine.
// Fires for tasks, reminders, and birthdays every minute.

import { db } from './db';

export async function ensurePermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try { return await Notification.requestPermission(); }
  catch { return 'denied'; }
}

async function fire(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) reg.showNotification(title, { body, tag, icon: '/logo192.png' });
    // eslint-disable-next-line no-new
    else new Notification(title, { body, tag });
  } catch { /* noop */ }
}

let timer = null;

const FIRED_KEY = 'lifetrq_fired_' + new Date().toISOString().split('T')[0];
const fired = new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'));
const _origAdd = fired.add.bind(fired);
fired.add = (k) => {
  _origAdd(k);
  localStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
  return fired;
};

const dailyNudges = {
  '08:00': {
    title: 'Plan your morning',
    body: 'Add the tasks that should shape today.',
  },
  '18:00': {
    title: 'Evening task check',
    body: 'Review what is left and finish the important items.',
  },
  '21:00': {
    title: 'Set up tomorrow',
    body: 'Add tasks for the next day while they are fresh.',
  },
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startReminderLoop() {
  if (timer) return;
  const tick = async () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const date = localDateKey(now);
    const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const key = `${date}-${time}`;

    try {
      const [tasks, reminders, birthdays] = await Promise.all([
        db.tasks.toArray(),
        db.reminders.toArray(),
        db.birthdays.toArray(),
      ]);

      const nudge = dailyNudges[time];
      if (nudge) {
        const pendingToday = tasks.filter((t) => !t.completed && (
          !t.date || t.date <= date || t.repeat === 'daily'
        )).length;
        const k = `nudge:${time}:${date}`;
        if (!fired.has(k)) {
          fired.add(k);
          const body = pendingToday > 0 ? `${nudge.body} ${pendingToday} task${pendingToday === 1 ? '' : 's'} pending.` : nudge.body;
          fire(nudge.title, body, k);
        }
      }

      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayName = weekDays[dayOfWeek];

      const matchesSchedule = (item) => {
        if (item.time !== time) return false;
        if (item.repeat === 'daily') return true;
        if (item.date === date) return true;
        if (item.repeat === 'weekly' && item.date) {
          const original = new Date(item.date);
          const daysSinceOriginal = Math.floor((now - original) / (1000 * 60 * 60 * 24));
          return original.getDay() === dayOfWeek && daysSinceOriginal % 7 === 0;
        }
        if (item.repeat === 'monthly' && item.date) {
          const [, , dd] = item.date.split('-');
          return parseInt(dd, 10) === now.getDate();
        }
        if (item.repeat === 'custom' && item.days) {
          return item.days.includes(todayName);
        }
        return false;
      };

      tasks
        .filter((t) => !t.completed && matchesSchedule(t))
        .forEach((t) => {
          const k = `task:${t.id}:${key}`;
          if (fired.has(k)) return;
          fired.add(k);
          fire(t.title, t.keyword && t.keyword !== 'general' ? `#${t.keyword}` : 'Task reminder', k);
        });

      reminders
        .filter((r) => matchesSchedule(r))
        .forEach((r) => {
          const k = `rem:${r.id}:${key}`;
          if (fired.has(k)) return;
          fired.add(k);
          fire(r.title || 'Reminder', r.notes || '', k);
        });

      // Birthdays: fire at 09:00 on the matching day.
      if (time === '09:00') {
        birthdays.forEach((b) => {
          if (!b.date) return;
          const bDate = b.date.includes('-') && b.date.length > 5
            ? b.date.slice(-5) // take last 5 chars: "MM-DD"
            : b.date;
          if (bDate === md) {
            const k = `birthday:${b.id}:${date}`;
            if (fired.has(k)) return;
            fired.add(k);
            fire(`${b.name}'s Birthday! 🎂`, `It's their special day (${b.relation})`, k);
          }
        });
      }
    } catch (err) {
      console.error('Reminder loop error:', err);
    }
  };
  tick();
  timer = setInterval(tick, 60 * 1000);
}

export function stopReminderLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function scheduleTaskNotification(task) {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg || !('showTrigger' in Notification.prototype)) {
    // Fallback: store in IndexedDB, check on next open (existing loop picks it up)
    return;
  }
  const fireAt = new Date(`${task.date}T${task.time || '09:00'}`);
  if (fireAt <= new Date()) return;

  // Note: TimestampTrigger is currently a draft API, but used in advanced PWAs
  // eslint-disable-next-line no-undef
  if (typeof TimestampTrigger !== 'undefined') {
    await reg.showNotification(task.title, {
      body: `#${task.keyword}`,
      tag: `task-${task.id}`,
      // eslint-disable-next-line no-undef
      showTrigger: new TimestampTrigger(fireAt.getTime()),
    });
  }
}
