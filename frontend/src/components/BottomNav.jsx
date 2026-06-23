import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Map, User, FolderOpen, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/roadmaps', icon: Map, label: 'Roadmaps' },
  { path: '/personal', icon: User, label: 'Personal' },
  { path: '/files', icon: FolderOpen, label: 'Files' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav 
      data-testid="bottom-navigation"
      className="fixed left-0 right-0 mx-auto w-[calc(100%-24px)] max-w-[406px] bg-white/90 backdrop-blur-2xl border border-white/40 shadow-xl rounded-full z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div className="flex justify-around items-center h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path === '/roadmaps' && location.pathname.startsWith('/roadmaps'));

          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className="relative flex items-center justify-center w-11 h-11"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-black rounded-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <div className="relative z-10">
                <Icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`} 
                />
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
