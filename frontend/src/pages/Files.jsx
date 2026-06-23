import { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import {
  Upload, FileText, Image as ImageIcon, Video, Music, File,
  Search, X, Sparkles, Check, Pencil, Trash2, NotebookTabs, AudioLines
} from 'lucide-react';
import { encryptBlob } from '@/lib/crypto';
import { isPdfFile, openPdfRecord } from '@/lib/fileOpen';
import { fileAnalysisService } from '@/services/FileAnalysisService';
import PreviewSheet from '@/components/PreviewSheet';

const TYPE_STYLES = {
  workout: { label: 'Workout', color: '#7A8F72' },
  resume: { label: 'Resume', color: '#68788D' },
  'lecture-notes': { label: 'Lecture', color: '#8F7AB8' },
  research: { label: 'Research', color: '#A07468' },
  reference: { label: 'Reference', color: '#7C7C84' },
  screenshot: { label: 'Screenshot', color: '#5E8FA3' },
  audio: { label: 'Audio', color: '#9C947A' },
};

const getFileIcon = (file) => {
  if (file.mime?.startsWith('audio/') || file.type?.startsWith('audio/')) return AudioLines;
  if (file.mime?.startsWith('image/') || file.type?.startsWith('image/')) return ImageIcon;
  return FileText;
};

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
};

function Stat({ Icon, label, value }) {
  return (
    <div className="bg-white rounded-[1.25rem] p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center">
      <Icon size={18} className="text-gray-400 mb-2" />
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

export default function Files() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState('');
  const [lastAction, setLastAction] = useState('');
  const inputRef = useRef(null);

  const liveFiles = useLiveQuery(() => db.files.toArray());
  const files = useMemo(() => liveFiles || [], [liveFiles]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return files
      .filter((file) => {
        const text = [file.name, file.analysis?.summary].filter(Boolean).join(' ').toLowerCase();
        return !needle || text.includes(needle);
      })
      .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
  }, [files, query]);

  const analyzeAndStore = async (file) => {
    setProcessing(file.name);
    try {
      const id = uid();
      const encrypted = await encryptBlob(file);

      const record = {
        id,
        name: file.name,
        size: file.size,
        mime: file.type,
        type: file.type, // Backwards compat
        cipher: encrypted.cipher,
        iv: encrypted.iv,
        uploadedAt: new Date().toISOString(),
      };

      const analysis = await fileAnalysisService.analyzeFile(file);
      record.analysis = analysis;

      await db.files.add(record);
    } catch (err) {
      console.error('Upload failed', err);
    }
    setProcessing('');
  };

  const uploadFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    for (const file of incoming) {
      await analyzeAndStore(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  const deleteFile = async (id) => {
    await db.files.delete(id);
    if (active?.id === id) setActive(null);
  };

  const renameFile = async (file) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await db.files.update(file.id, { name: trimmed });
    setEditingId(null);
    setNewName('');
  };

  const openFile = async (file) => {
    if (isPdfFile(file)) {
      try {
        await openPdfRecord(file);
      } catch (e) {
        setActive(file);
      }
      return;
    }
    setActive(file);
  };

  const applyToLifeSystems = async (file) => {
    const analysis = file.analysis;
    if (!analysis) return;

    // Ported logic for integrating tasks/habits
    const tag = analysis.detectedType || 'files';

    for (const task of (analysis.tasks || []).slice(0, 6)) {
      await db.tasks.add({
        title: typeof task === 'string' ? task : task.title,
        completed: false,
        keyword: tag,
        priority: task.priority || 'medium',
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
    }

    await db.files.update(file.id, { integratedAt: new Date().toISOString() });
    setLastAction(`Integrated ${file.name}`);
    setTimeout(() => setLastAction(''), 3000);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#F5F7FA] via-[#F8F8FB] to-[#EFEFF5] overflow-hidden" data-testid="files-page">
      {/* Fixed Top Section */}
      <div className="flex-shrink-0">
      <div className="px-5 pt-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-bold mb-2">DOCUMENTS</p>
            <GiantHeading className="leading-[0.9]">FILES</GiantHeading>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 grid grid-cols-3 gap-3 mb-6">
        <Stat Icon={FileText} label="Total" value={files.length} />
        <Stat Icon={Sparkles} label="Intelligent" value={files.filter(f => f.analysis).length} />
        <Stat Icon={Check} label="Applied" value={files.filter(f => f.integratedAt).length} />
      </div>

      <div className="px-5 mb-6">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,image/*,audio/*"
          onChange={(e) => uploadFiles(e.target.files)}
          className="hidden"
        />
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`bg-white rounded-[2rem] p-10 border-2 border-dashed cursor-pointer transition-all text-center shadow-sm ${
            dragging ? 'border-black scale-[1.02] bg-gray-50' : 'border-gray-200'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-black mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <p className="font-black text-xl mb-1">Drop files here</p>
          <p className="text-sm text-gray-400 font-medium">PDFs, images, audio, and documents.</p>
          {processing && (
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-black animate-pulse">
              Processing {processing}...
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
      <div className="mb-6">
        <div className="bg-white rounded-full p-4 px-6 flex items-center gap-3 shadow-sm border border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search summaries, types, context..."
            className="flex-1 outline-none text-sm font-semibold"
          />
        </div>
        <AnimatePresence>
          {lastAction && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-xs font-bold text-green-700 border border-green-100"
            >
              <Check size={14} /> {lastAction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-12 text-center shadow-sm border border-white/60">
            <NotebookTabs className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="font-black text-lg">No intelligent files yet</p>
            <p className="text-sm text-gray-400 mt-1 font-medium">Upload a workout, resume, notes, or reference.</p>
          </div>
        ) : (
          filtered.map(file => {
            const Icon = getFileIcon(file);
            const style = TYPE_STYLES[file.analysis?.detectedType] || TYPE_STYLES.reference;

            return (
              <motion.div
                key={file.id}
                layout
                className="bg-white/80 backdrop-blur-sm rounded-[1.5rem] p-4 shadow-sm border border-white/60 flex items-center gap-4 group"
              >
                <div
                  onClick={() => openFile(file)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90 shadow-sm"
                  style={{ backgroundColor: `${style.color}15`, color: style.color }}
                >
                  <Icon size={20} />
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openFile(file)}>
                  {editingId === file.id ? (
                    <input
                      autoFocus
                      value={newName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameFile(file);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full text-sm font-bold bg-gray-50 rounded-lg px-2 py-1 outline-none"
                    />
                  ) : (
                    <>
                      <p className="font-bold text-sm truncate text-gray-900">{file.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {formatSize(file.size)} • {style.label}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {file.analysis && !file.integratedAt && (
                    <button
                      onClick={() => applyToLifeSystems(file)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                      title="Integrate into Life OS"
                    >
                      <Sparkles size={16} />
                    </button>
                  )}
                  {file.integratedAt && (
                    <div className="p-2 text-green-500">
                      <Check size={16} />
                    </div>
                  )}
                  <button
                    onClick={() => { setEditingId(file.id); setNewName(file.name); }}
                    className="p-2 text-gray-300 hover:text-gray-600 rounded-full transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="p-2 text-gray-300 hover:text-red-500 rounded-full transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      </div>

      {active && (
        <PreviewSheet
          record={active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
