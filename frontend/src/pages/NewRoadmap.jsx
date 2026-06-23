import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { aiService } from '@/lib/ai';
import { motion } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import GlassCard from '@/components/GlassCard';
import { ArrowLeft, Sparkles, Link as LinkIcon, Loader2, Plus, X } from 'lucide-react';

const KEYWORDS = [
  { id: 'career', label: 'Career', color: '#3B82F6' },
  { id: 'study', label: 'Study', color: '#8B5CF6' },
  { id: 'fitness', label: 'Fitness', color: '#10B981' },
  { id: 'business', label: 'Business', color: '#F59E0B' },
  { id: 'personal', label: 'Personal', color: '#EC4899' },
];

export default function NewRoadmap() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('manual'); // 'manual' or 'ai'
  
  // Manual mode
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('career');
  const [isCustomKeyword, setIsCustomKeyword] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [milestones, setMilestones] = useState([{ title: '', tasks: [] }]);

  // AI mode
  const [url, setUrl] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const handleAIGenerate = async () => {
    if (!url.trim()) return;
    setAiGenerating(true);

    try {
      const response = await aiService.generateRoadmapFromURL(url);
      
      // Try to parse JSON from response
      let parsed;
      try {
        // Extract JSON from response (in case AI wraps it in markdown)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }

      if (parsed) {
        setAiResult(parsed);
        setTitle(parsed.title || 'New Roadmap');
        setDescription(parsed.description || '');
        if (parsed.plans) {
          setMilestones(parsed.plans.map((p, i) => ({
            title: p.title || `Phase ${i + 1}`,
            tasks: p.tasks || []
          })));
        } else if (parsed.milestones) {
          // Backward compatibility for old AI response
          setMilestones(parsed.milestones.map((m, i) => ({
            title: m.title || `Milestone ${i + 1}`,
            tasks: m.topics || []
          })));
        }
        // Set due date based on milestones
        if (parsed.estimatedDuration) {
          const weeks = parseInt(parsed.estimatedDuration) || 12;
          const due = new Date();
          due.setDate(due.getDate() + weeks * 7);
          setDueDate(due.toISOString().split('T')[0]);
        }
        setMode('review');
      } else {
        alert('Could not parse AI response. Please try again or use manual mode.');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate roadmap. Please check your API keys.');
    } finally {
      setAiGenerating(false);
    }
  };

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', tasks: [] }]);
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const updateMilestoneTasks = (index, tasksString) => {
    const updated = [...milestones];
    updated[index].tasks = tasksString.split('\n').filter(t => t.trim());
    setMilestones(updated);
  };

  const removeMilestone = (index) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || !dueDate) {
      alert('Please provide title and due date');
      return;
    }

    const selectedKeyword = KEYWORDS.find(k => k.id === keyword);

    const roadmapId = await db.roadmaps.add({
      title: title.trim(),
      keyword,
      dueDate,
      description,
      progress: 0,
      color: selectedKeyword?.color || '#3B82F6',
      createdAt: new Date().toISOString()
    });

    // Add milestones (plans)
    const validMilestones = milestones.filter(m => m.title.trim());
    for (let i = 0; i < validMilestones.length; i++) {
      const m = validMilestones[i];
      const planId = await db.plans.add({
        roadmapId,
        name: m.title,
        done: false,
        order: i,
        createdAt: new Date().toISOString()
      });

      // Add nested tasks if any
      if (m.tasks && m.tasks.length > 0) {
        await db.tasks.bulkAdd(
          m.tasks.map(taskTitle => ({
            title: taskTitle,
            date: null,
            time: null,
            completed: false,
            roadmapId,
            planId,
            keyword: 'general',
            priority: 'medium',
            repeat: 'no-repeat',
            createdAt: new Date().toISOString()
          }))
        );
      }
    }

    navigate(`/roadmaps/${roadmapId}`);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="new-roadmap-page">
      <div className="flex-shrink-0 px-5 pt-8 pb-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <button
          onClick={() => navigate('/roadmaps')}
          className="flex items-center gap-2 text-gray-600 mb-4 hover:text-black transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel
        </button>

        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">CREATE</p>
        <GiantHeading className="leading-[0.9]">NEW ROADMAP</GiantHeading>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-6 pb-40 scrollbar-hide">
        {/* Mode Switcher */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit">
          <button
            onClick={() => setMode('manual')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              mode === 'manual' ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
            data-testid="manual-mode-button"
          >
            Manual
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
              mode === 'ai' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm' : 'text-gray-600'
            }`}
            data-testid="ai-mode-button"
          >
            <Sparkles className="w-4 h-4" />
            AI from URL
          </button>
        </div>

        {/* AI Mode */}
        {mode === 'ai' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlassCard className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg mb-1">AI Roadmap Generator</h3>
                  <p className="text-sm text-gray-600">
                    Paste a Udemy, YouTube, or any course URL and AI will create a structured learning roadmap with milestones.
                  </p>
                </div>
              </div>

              <div className="relative">
                <LinkIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://udemy.com/... or https://youtube.com/..."
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl outline-none border border-gray-200 focus:border-purple-400 transition-colors"
                  data-testid="ai-url-input"
                />
              </div>

              <button
                onClick={handleAIGenerate}
                disabled={!url.trim() || aiGenerating}
                className="mt-4 w-full py-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                data-testid="generate-roadmap-button"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating roadmap...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Roadmap with AI
                  </>
                )}
              </button>
            </GlassCard>
          </motion.div>
        )}

        {/* Manual/Review Mode - Show form */}
        {(mode === 'manual' || mode === 'review') && (
          <>
            {mode === 'review' && (
              <GlassCard className="bg-purple-50 border-purple-200">
                <div className="flex items-center gap-2 text-purple-700">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-semibold">AI Generated - Review and edit below</span>
                </div>
              </GlassCard>
            )}

            <GlassCard>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Master Python in 3 Months"
                    className="w-full p-3 bg-gray-50 rounded-2xl outline-none"
                    data-testid="roadmap-title-input"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-2">
                    Keyword
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {KEYWORDS.map(kw => (
                      <button
                        key={kw.id}
                        onClick={() => {
                          setKeyword(kw.id);
                          setIsCustomKeyword(false);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          !isCustomKeyword && keyword === kw.id
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        style={!isCustomKeyword && keyword === kw.id ? { backgroundColor: kw.color } : {}}
                        data-testid={`keyword-${kw.id}`}
                      >
                        {kw.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={isCustomKeyword ? keyword : ''}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setIsCustomKeyword(true);
                    }}
                    placeholder="Or type custom keyword..."
                    className={`w-full p-3 rounded-2xl outline-none text-sm transition-all ${
                      isCustomKeyword
                        ? 'bg-white border-2 border-black shadow-sm'
                        : 'bg-gray-50 border border-transparent focus:border-gray-200'
                    }`}
                    data-testid="custom-keyword-input"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-2xl outline-none"
                    data-testid="roadmap-duedate-input"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What do you want to achieve?"
                    rows={3}
                    className="w-full p-3 bg-gray-50 rounded-2xl outline-none resize-none"
                  />
                </div>
              </div>
            </GlassCard>

            {/* Milestones */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Milestones</h3>
                <button
                  onClick={addMilestone}
                  className="px-4 py-2 rounded-full bg-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                  data-testid="add-milestone-button"
                >
                  <Plus className="w-4 h-4" />
                  Add Milestone
                </button>
              </div>

              <div className="space-y-3">
                {milestones.map((m, idx) => (
                  <GlassCard key={idx} hoverable={false}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={m.title}
                          onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                          placeholder={`Milestone ${idx + 1}`}
                          className="w-full p-2 bg-gray-50 rounded-xl outline-none font-semibold"
                          data-testid={`milestone-title-${idx}`}
                        />
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">
                            Tasks (one per line)
                          </label>
                          <textarea
                            value={m.tasks?.join('\n')}
                            onChange={(e) => updateMilestoneTasks(idx, e.target.value)}
                            placeholder="Add tasks..."
                            rows={3}
                            className="w-full p-2 bg-gray-50 rounded-xl outline-none text-sm resize-none"
                            data-testid={`milestone-tasks-${idx}`}
                          />
                        </div>
                      </div>
                      {milestones.length > 1 && (
                        <button
                          onClick={() => removeMilestone(idx)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          data-testid={`remove-milestone-${idx}`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!title.trim() || !dueDate}
              className="w-full py-4 rounded-full bg-black text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
              data-testid="save-roadmap-button"
            >
              Create Roadmap
            </button>
          </>
        )}
      </div>
    </div>
  );
}
