import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GiantHeading from '@/components/GiantHeading';
import { Plus, ChevronRight, Map, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

const SWIPE_THRESHOLD = 150;

function RoadmapCard({ roadmap, index, onClick, onDelete }) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.8, 1.1]);
  const dragging = useRef(false);

  const onDragEnd = (_, info) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      if (window.navigator?.vibrate) window.navigator.vibrate(10);
      onDelete(roadmap);
    }
    x.set(0);
    setTimeout(() => { dragging.current = false; }, 80);
  };

  return (
    <div className="relative overflow-hidden rounded-[1.75rem]">
      {/* Delete Background Reveal */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-red-500 flex items-center pl-8 text-white font-bold"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2">
          <Trash2 size={24} />
          <span>DELETE</span>
        </motion.div>
      </motion.div>

      <motion.button
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragMomentum={false}
        onDragStart={() => { dragging.current = true; }}
        onDragEnd={onDragEnd}
        style={{ x, touchAction: 'pan-y' }}
        onClick={() => !dragging.current && onClick()}
        data-testid={`roadmap-card-${roadmap.id}`}
        className="relative z-10 w-full bg-white/80 backdrop-blur-sm rounded-[1.75rem] p-5 text-left shadow-sm hover:shadow-md transition-shadow border border-white/60"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${roadmap.color}15` }}
          >
            <Map className="w-6 h-6" style={{ color: roadmap.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: roadmap.color }}
              />
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                #{roadmap.keyword}
              </span>
            </div>
            <h3 className="text-lg font-bold mb-1 truncate">{roadmap.title}</h3>
            <p className="text-xs text-gray-500">Due {roadmap.dueDate}</p>

            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: roadmap.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${roadmap.progress || 0}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                />
              </div>
              <span className="text-sm font-bold">{roadmap.progress || 0}%</span>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>
      </motion.button>
    </div>
  );
}

export default function Roadmaps() {
  const navigate = useNavigate();
  const roadmaps = useLiveQuery(() => db.roadmaps.toArray());

  const handleDeleteRoadmap = async (roadmap) => {
    // Immediate deletion from DB
    await db.roadmaps.delete(roadmap.id);

    // Also delete associated plans and tasks
    const associatedPlans = await db.plans.where('roadmapId').equals(roadmap.id).toArray();
    const planIds = associatedPlans.map(p => p.id);
    const associatedTasks = await db.tasks.where('roadmapId').equals(roadmap.id).toArray();
    const taskIds = associatedTasks.map(t => t.id);

    await db.plans.bulkDelete(planIds);
    await db.tasks.bulkDelete(taskIds);

    toast("Roadmap Deleted", {
      description: `All associated plans and tasks removed.`,
      action: {
        label: "Undo",
        onClick: async () => {
          await db.roadmaps.add(roadmap);
          if (associatedPlans.length > 0) await db.plans.bulkAdd(associatedPlans);
          if (associatedTasks.length > 0) await db.tasks.bulkAdd(associatedTasks);
          toast.success("Roadmap restored");
        },
      },
    });
  };

  if (!roadmaps) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="roadmaps-page">
      <div className="flex-shrink-0 px-5 pt-8 pb-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">SYSTEMS</p>
            <GiantHeading className="leading-[0.9]">ROADMAPS</GiantHeading>
            <p className="text-gray-500 mt-2 text-sm">Build the systems that shape your life.</p>
          </div>
          <button 
            className="mt-4 px-5 py-2.5 bg-black text-white rounded-full font-semibold shadow-lg hover:scale-105 transition-all flex items-center gap-2 text-sm"
            onClick={() => navigate('/roadmaps/new')}
            data-testid="new-roadmap-button"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        {roadmaps.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-10 text-center border border-white/60">
            <Map className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4 font-semibold">No roadmaps yet</p>
            <button 
              className="px-5 py-2.5 bg-black text-white rounded-full font-semibold text-sm"
              onClick={() => navigate('/roadmaps/new')}
            >
              Create Your First Roadmap
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {roadmaps.map((roadmap, index) => (
                <motion.div
                  key={roadmap.id}
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
                  <RoadmapCard
                    roadmap={roadmap}
                    index={index}
                    onClick={() => navigate(`/roadmaps/${roadmap.id}`)}
                    onDelete={handleDeleteRoadmap}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
