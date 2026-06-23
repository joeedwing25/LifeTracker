// AI Service Layer for Gemini and Groq (Local-first PWA)
import { db } from './db';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class AIService {
  constructor(provider = 'groq') {
    this.provider = provider;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async generateWithGemini(prompt) {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
    });
    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response';
  }

  async generateWithGroq(prompt) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
    if (!response.ok) throw new Error(`Groq error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response';
  }

  async generate(prompt, options = {}) {
    const provider = options.provider || this.provider;
    try {
      if (provider === 'gemini') return await this.generateWithGemini(prompt);
      return await this.generateWithGroq(prompt);
    } catch (err) {
      // Fallback to other provider
      try {
        if (provider === 'gemini') return await this.generateWithGroq(prompt);
        return await this.generateWithGemini(prompt);
      } catch (err2) {
        throw new Error('All AI providers failed');
      }
    }
  }

  async chat(message, context = {}) {
    const prompt = `You are a helpful AI assistant for Life OS. You are an ACTION EXECUTION AGENT.
When a user asks to create something (task, roadmap, reminder, routine, etc.), you MUST generate the appropriate action.
If no action is needed, return an empty actions array.

Current Date: ${new Date().toISOString().split('T')[0]}
Available Keywords: Personal, Health, Business, Academics, Career, Fitness, Study.

Return ONLY a JSON object:
{
  "message": "Conversational response confirming what you did",
  "actions": [
    { "type": "CREATE_TASK", "data": { "title": "...", "date": "YYYY-MM-DD", "time": "HH:mm", "repeat": "no-repeat|daily|weekly|monthly", "priority": "low|medium|high", "keyword": "...", "isHealth": boolean } },
    { "type": "CREATE_REMINDER", "data": { "title": "...", "date": "YYYY-MM-DD", "time": "HH:mm", "repeat": "...", "notes": "..." } },
    { "type": "CREATE_ROADMAP", "data": { "title": "...", "keyword": "...", "dueDate": "YYYY-MM-DD", "color": "HEX", "plans": [ { "name": "...", "tasks": ["..."] } ] } }
  ]
}

Rules:
- Assign to 'Health' or 'Fitness' if it relates to body, exercise, hygiene, or food.
- For recurring tasks like "morning and evening", create TWO separate CREATE_TASK actions.
- "Learn React in 3 months" -> CREATE_ROADMAP with 3-5 milestones (plans) and tasks.
- If no action, "actions" is [].
- Respond ONLY with JSON. No markdown blocks.

User context: ${JSON.stringify(context)}
User: ${message}`;
    return await this.generate(prompt);
  }

  async generateDailySummary(data) {
    const prompt = `Generate a brief 2-3 line motivational summary based on: ${JSON.stringify(data)}. Be concise and encouraging. No markdown.`;
    return await this.generate(prompt);
  }

  async generateRoadmapFromURL(url) {
    const prompt = `Create a structured learning roadmap from this URL: ${url}

Return ONLY valid JSON in this exact format:
{
  "title": "Course title",
  "description": "1 sentence description",
  "estimatedDuration": "12",
  "plans": [
    {
      "title": "Phase 1: ...",
      "tasks": ["Task 1", "Task 2"]
    }
  ]
}

If you can't infer the course, generate a generic roadmap based on URL keywords. Return ONLY the JSON, no markdown.`;
    return await this.generate(prompt);
  }

  async analyzeProductivity(analyticsData) {
    const prompt = `Analyze productivity data: ${JSON.stringify(analyticsData)}. Give 3 short bullet insights.`;
    return await this.generate(prompt);
  }

  async analyzeSkill(skillName, history) {
    const prompt = `User is learning ${skillName}. Recent activity: ${JSON.stringify(history)}. Estimate proficiency (Beginner/Intermediate/Advanced) and give 2 next-step recommendations.`;
    return await this.generate(prompt);
  }

  async businessAdvisor(question, context) {
    const prompt = `You are a business and career advisor. Context: ${JSON.stringify(context)}. Question: ${question}. Give actionable advice in 3 bullets.`;
    return await this.generate(prompt);
  }

  async executeActions(actions) {
    if (!actions || !Array.isArray(actions)) return;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CREATE_TASK':
            await this.handleCreateTask(action.data);
            break;
          case 'CREATE_REMINDER':
            await this.handleCreateReminder(action.data);
            break;
          case 'CREATE_ROADMAP':
            await this.handleCreateRoadmap(action.data);
            break;
          default:
            console.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
        throw error;
      }
    }
  }

  async handleCreateTask(data) {
    const task = {
      title: data.title,
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '09:00',
      completed: false,
      repeat: data.repeat || 'no-repeat',
      priority: data.priority || 'medium',
      keyword: data.keyword?.toLowerCase() || 'general',
      isHealth: !!data.isHealth,
      createdAt: new Date().toISOString()
    };
    await db.tasks.add(task);
  }

  async handleCreateReminder(data) {
    const reminder = {
      title: data.title,
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '09:00',
      repeat: data.repeat || 'no-repeat',
      notes: data.notes || '',
      createdAt: new Date().toISOString()
    };
    await db.reminders.add(reminder);
  }

  async handleCreateRoadmap(data) {
    const roadmapId = await db.roadmaps.add({
      title: data.title,
      keyword: data.keyword?.toLowerCase() || 'general',
      dueDate: data.dueDate,
      progress: 0,
      color: data.color || '#3B82F6',
      createdAt: new Date().toISOString()
    });

    if (data.plans && Array.isArray(data.plans)) {
      for (let i = 0; i < data.plans.length; i++) {
        const p = data.plans[i];
        const planId = await db.plans.add({
          roadmapId,
          name: p.name,
          done: false,
          order: i,
          createdAt: new Date().toISOString()
        });

        if (p.tasks && Array.isArray(p.tasks)) {
          const tasksToAdd = p.tasks.map(t => ({
            title: t,
            date: null,
            time: null,
            completed: false,
            roadmapId,
            planId,
            keyword: data.keyword?.toLowerCase() || 'general',
            priority: 'medium',
            repeat: 'no-repeat',
            createdAt: new Date().toISOString()
          }));
          await db.tasks.bulkAdd(tasksToAdd);
        }
      }
    }
  }
}

export const aiService = new AIService();
