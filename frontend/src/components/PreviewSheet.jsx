import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Music } from 'lucide-react';
import { decryptBlob } from '@/lib/crypto';

export default function PreviewSheet({ record, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const mime = record?.mime || record?.type || '';
  const name = record?.name || 'file';
  const normalizedMime = mime.toLowerCase();
  const normalizedName = name.toLowerCase();

  const isAudio = normalizedMime.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg|oga|flac|webm)$/.test(normalizedName);
  const isVideo = normalizedMime.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(normalizedName);
  const isImage = normalizedMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif)$/.test(normalizedName);
  const isText = normalizedMime.startsWith('text/') || normalizedMime === 'application/json' || /\.(txt|md|json|csv|log)$/.test(normalizedName);

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    if (!record) return;

    (async () => {
      try {
        const blob = await decryptBlob(record);
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch (e) {
        setError('Unable to decrypt this file.');
      }
    })();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [record]);

  if (!record) return null;

  const renderBody = () => {
    if (error) return <p className="text-sm text-red-600 p-6">{error}</p>;
    if (!url) return <p className="text-sm text-gray-500 p-6">Decrypting...</p>;

    if (isImage) {
      return (
        <div className="w-full h-full min-h-[220px] rounded-xl bg-gray-50 p-2 flex items-center justify-center overflow-auto">
          <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="w-full h-full min-h-[220px] rounded-xl bg-gray-50 p-2 flex items-center justify-center">
          <video src={url} controls className="max-w-full max-h-full rounded-xl" />
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="w-full rounded-2xl bg-white p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">
              <Music size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-gray-500">Audio file</p>
            </div>
          </div>
          <audio src={url} controls className="w-full" />
        </div>
      );
    }
    if (isText) {
      return <TextPreview url={url} />;
    }

    return (
      <a href={url} download={name} className="inline-flex items-center gap-2 bg-black text-white rounded-2xl px-4 py-3 font-semibold">
        <Download size={16} /> Download to view
      </a>
    );
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-[2.5rem] p-6 flex flex-col"
          data-testid="preview-sheet"
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="flex items-center justify-between mb-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{mime || 'file'}</p>
              <h2 className="text-lg font-bold truncate">{name}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center">
            {renderBody()}
          </div>
          {url && mime !== 'application/pdf' && (
            <a href={url} download={name} className="mt-6 flex items-center gap-2 text-sm font-bold text-gray-600">
              <Download size={16} /> Download
            </a>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TextPreview({ url }) {
  const [text, setText] = useState('');
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText).catch(() => setText(''));
  }, [url]);
  return (
    <pre className="text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded-xl max-h-[60vh] overflow-auto w-full">
      {text}
    </pre>
  );
}
