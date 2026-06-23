import { aiService } from '@/lib/ai';
import { transcriptionService } from '@/services/TranscriptionService';

const CATEGORY_RULES = [
  { type: 'workout', pattern: /workout|fitness|strength|hypertrophy|cardio|mobility|protein|sets?|reps?|push|pull|legs|run/i },
  { type: 'resume', pattern: /resume|curriculum|experience|education|skills|projects|linkedin|portfolio/i },
  { type: 'lecture-notes', pattern: /lecture|chapter|module|exam|assignment|notes|syllabus|study|course/i },
  { type: 'research', pattern: /abstract|methodology|hypothesis|references|literature|dataset|results|discussion/i },
  { type: 'reference', pattern: /reference|documentation|guide|manual|checklist|framework|template/i },
  { type: 'screenshot', pattern: /screenshot|screen shot|image|photo|png|jpg|jpeg|webp/i },
  { type: 'audio', pattern: /audio|voice|recording|transcript|meeting|call/i },
];

function asTextFromBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunk));
  }
  return binary;
}

function cleanPdfText(raw) {
  const matches = raw.match(/\((?:\\.|[^\\)]){4,}\)/g) || [];
  const decoded = matches
    .map((item) => item.slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\n|\\r/g, ' '))
    .join('\n');
  return decoded.replace(/\s{2,}/g, ' ').slice(0, 16000);
}

function splitSentences(text) {
  return text
    .replace(/\r/g, '\n')
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim().replace(/^[-*•\d.)\s]+/, ''))
    .filter((line) => line.length > 5);
}

function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferType(text, file) {
  const haystack = `${file.name} ${file.type} ${text}`;
  return CATEGORY_RULES.find((rule) => rule.pattern.test(haystack))?.type || 'reference';
}

function localAnalyze(text, file) {
  const lines = splitSentences(text);
  const detectedType = inferType(text, file);

  const tasks = lines.filter(l => /todo|task|finish|complete|read|write/i.test(l)).slice(0, 6);
  const habits = lines.filter(l => /daily|weekly|habit|routine/i.test(l)).slice(0, 4);

  return {
    title: titleFromFile(file.name),
    summary: lines.slice(0, 3).join(' '),
    detectedType,
    tasks,
    habits,
    milestones: [],
    goals: [],
    identityUpdates: [],
    questions: [`Should ${titleFromFile(file.name)} update an existing roadmap or create a new one?`],
  };
}

export class FileAnalysisService {
  async extractText(file) {
    if (file.type.startsWith('audio/')) {
      try {
        const transcript = await transcriptionService.transcribe(file);
        return { text: transcript.text, transcriptionStatus: 'complete' };
      } catch (error) {
        return { text: '', transcriptionStatus: 'failed' };
      }
    }
    if (file.type.startsWith('image/')) {
      return { text: '', ocrStatus: 'queued' };
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const raw = asTextFromBytes(await file.arrayBuffer());
      const text = cleanPdfText(raw);
      return { text: text || '', ocrStatus: text ? 'embedded-text' : 'queued' };
    }
    if (/text|json|csv|markdown/i.test(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)) {
      return { text: (await file.text()).slice(0, 24000) };
    }
    return { text: '' };
  }

  async analyzeFile(file) {
    const extracted = await this.extractText(file);
    const local = localAnalyze(extracted.text, file);

    let aiResult = null;
    try {
      const prompt = `Analyze this file content and extract tasks, habits, and a summary.
Return valid JSON like: {"summary": "...", "tasks": ["..."]}.
Content: ${extracted.text.slice(0, 4000)}`;

      const response = await aiService.generate(prompt);
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        aiResult = JSON.parse(response.slice(jsonStart, jsonEnd));
      } else {
        aiResult = { summary: response };
      }
    } catch (error) {
      console.warn('AI analysis failed', error);
    }

    return {
      ...local,
      summary: aiResult?.summary || local.summary,
      tasks: aiResult?.tasks || local.tasks,
      extractedText: extracted.text,
      analyzedAt: Date.now(),
    };
  }
}

export const fileAnalysisService = new FileAnalysisService();
