import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { aiService } from '@/lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import GiantHeading from '@/components/GiantHeading';
import GlassCard from '@/components/GlassCard';
import { Send, Mic, MicOff, Sparkles, User, Bot } from 'lucide-react';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your Life OS AI assistant. I can help you with tasks, roadmaps, productivity insights, and more. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const settings = useLiveQuery(() => db.settings.get('main'));

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get context from database
      const tasks = await db.tasks.toArray();
      const roadmaps = await db.roadmaps.toArray();
      const habits = await db.habits.toArray();

      const context = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        roadmaps: roadmaps.map(r => ({ title: r.title, progress: r.progress })),
        habits: habits.map(h => ({ title: h.title, streak: h.streak }))
      };

      const responseText = await aiService.chat(userMessage.content, context);

      let aiResponse;
      try {
        // AI might return JSON wrapped in markdown or just plain JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        aiResponse = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch (e) {
        console.error('Failed to parse AI response:', responseText);
        aiResponse = { message: responseText, actions: [] };
      }

      // Database First: Execute actions BEFORE showing the message
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        await aiService.executeActions(aiResponse.actions);
      }

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse.message || 'Done.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to database
      await db.aiChats.add({
        ...userMessage,
        timestamp: userMessage.timestamp.toISOString(),
        sessionId: 'main'
      });
      await db.aiChats.add({
        ...assistantMessage,
        timestamp: assistantMessage.timestamp.toISOString(),
        sessionId: 'main'
      });
    } catch (error) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-50 to-gray-100 pb-24 flex flex-col" data-testid="ai-assistant-page">
      <div className="px-5 pt-8 pb-6 flex-shrink-0">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">ASSISTANT</p>
        <div className="flex items-center gap-3">
          <GiantHeading className="text-5xl md:text-6xl">AI CHAT</GiantHeading>
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Powered by {settings?.aiProvider === 'gemini' ? 'Google Gemini' : 'Groq'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 px-5 overflow-y-auto space-y-4 pb-6">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              data-testid={`message-${index}`}
            >
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <GlassCard 
                className={`max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-black/90 text-white border-black/50' 
                    : ''
                }`}
                hoverable={false}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-white/50' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </GlassCard>

              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <GlassCard hoverable={false}>
              <div className="flex gap-2">
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [-3, 0, -3] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [-3, 0, -3] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [-3, 0, -3] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                />
              </div>
            </GlassCard>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-6 flex-shrink-0">
        <GlassCard className="p-4" hoverable={false}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent outline-none text-base"
              disabled={isLoading}
              data-testid="ai-input"
            />
            <button
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              className={`p-3 rounded-full transition-all ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              data-testid="voice-button"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-full bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
              data-testid="send-button"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}