import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeAppData } from '@/lib/db';
import { startReminderLoop } from '@/lib/notifications';
import BottomNav from '@/components/BottomNav';
import FloatingAIOrb from '@/components/FloatingAIOrb';
import FocusMiniPlayer from '@/components/FocusMiniPlayer';
import AddTaskModal from '@/components/AddTaskModal';
import LockScreen from '@/components/LockScreen';
import Home from '@/pages/Home';
import Calendar from '@/pages/Calendar';
import Roadmaps from '@/pages/Roadmaps';
import RoadmapDetail from '@/pages/RoadmapDetail';
import NewRoadmap from '@/pages/NewRoadmap';
import Personal from '@/pages/Personal';
import Files from '@/pages/Files';
import Settings from '@/pages/Settings';
import AIAssistant from '@/pages/AIAssistant';
import Focus from '@/pages/Focus';
import { Plus } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import '@/App.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAddTask, setShowAddTask] = useState(false);
  const settings = useLiveQuery(() => db.settings.get('main'));
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    initializeAppData();
    startReminderLoop();

    // Prevent pinch-to-zoom
    const handleTouchStart = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    const handleTouchEnd = (e) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, false);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Lock logic
  useEffect(() => {
    if (settings && !settings.passcode) {
      setLocked(false);
    }
  }, [settings]);

  // Re-lock on invisibility (optional but common for security apps)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && settings?.passcode) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings]);

  const handleAIOrbClick = () => navigate('/ai');

  const hideUI = location.pathname === '/focus' || location.pathname === '/ai';
  const showFAB = !hideUI && !location.pathname.startsWith('/roadmaps/new');

  if (!settings) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" /></div>;
  }

  if (locked && settings.passcode) {
    return <LockScreen settings={settings} onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="mobile-container" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/roadmaps" element={<Roadmaps />} />
        <Route path="/roadmaps/new" element={<NewRoadmap />} />
        <Route path="/roadmaps/:id" element={<RoadmapDetail />} />
        <Route path="/personal" element={<Personal />} />
        <Route path="/files" element={<Files />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/focus" element={<Focus />} />
      </Routes>

      {!hideUI && <BottomNav />}
      {!hideUI && <FloatingAIOrb onClick={handleAIOrbClick} />}
      <FocusMiniPlayer />

      {showFAB && (
        <button
          onClick={() => setShowAddTask(true)}
          className="fixed z-40 w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)',
            right: 'calc(50% - 215px + 16px)'
          }}
          data-testid="add-task-fab"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onTaskAdded={(task) => {
          // If we are on Home page, we might want to trigger the popup
          // But Home.jsx is a separate route.
          // We can't easily pass it down without a context or global state.
          // However, for this task, I'll just keep it simple.
        }}
      />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
