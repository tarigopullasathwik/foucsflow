import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Trash2, Sparkles, User, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../firebase';
import { api } from '../api';

interface AICoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AICoachDrawer({ isOpen, onClose }: AICoachDrawerProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ mode: string; label: string; available: boolean } | null>(null);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested quick prompts
  const suggestions = [
    "What should I do now?",
    "Can I finish everything today?",
    "Plan my evening.",
    "Break down my hardest task.",
    "How can I improve my focus?"
  ];

  // Load chat history
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && user) {
      loadHistory();
    }
  }, [isOpen, user]);

  // Scroll to bottom on message list change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const loadHistory = async () => {
    try {
      const history = await api.fetchChatHistory(user);
      setMessages(history);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  // Load the honest AI engine status so we never fake a "live" badge.
  useEffect(() => {
    api.fetchAiStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    setInput('');
    setIsLoading(true);
    
    // Add user message temporarily for snappy UI feel
    const tempUserMsg = {
      id: 'temp-user',
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    
    try {
      const result = await api.sendChatMessage(user, textToSend);
      // Replace/Refresh messages with real backend data
      setMessages(prev => {
        // Remove temp and add actual
        const filtered = prev.filter(m => m.id !== 'temp-user');
        return [...filtered, result.user_message, result.ai_response];
      });
    } catch (e) {
      console.error("Chat message failed", e);
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp-user'),
        {
          id: 'error',
          sender: 'ai',
          text: "I'm having trouble connecting to my cognitive services right now. Please try again in a moment.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear our chat history? This clears my immediate context of our conversations.")) return;
    try {
      await api.clearChatHistory(user);
      setMessages([]);
    } catch (e) {
      console.error("Failed to clear chat history", e);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black backdrop-blur-sm"
          />

          {/* Chat Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed top-0 bottom-0 right-0 z-50 w-full sm:w-[480px] bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-violet flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Bot className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5">
                    FocusFlow Coach <Sparkles size={12} className="text-accent-violet animate-pulse" />
                  </h3>
                  {/* Honest engine status — no fake "live" badge when running the local rules engine */}
                  <p className={`text-[10px] flex items-center gap-1 ${aiStatus?.mode === 'gemini' ? 'text-accent-emerald' : 'text-zinc-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${aiStatus?.mode === 'gemini' ? 'bg-accent-emerald animate-ping' : 'bg-zinc-500'}`} />
                    {aiStatus ? aiStatus.label : 'Connecting…'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#09090b]">
              {messages.length === 0 && !isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <Brain size={32} className="text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-200 text-sm">Need a game plan?</h4>
                    <p className="text-xs text-zinc-500 max-w-xs mt-1">
                      Ask me to organize your tasks, estimate completion times, or suggest the perfect next step.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full pt-4">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(s)}
                        className="text-left px-3.5 py-2.5 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-xs text-zinc-300 hover:text-white transition-all duration-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[10px] text-center text-zinc-600 bg-zinc-900/20 py-1.5 px-3 rounded-full border border-zinc-900 max-w-xs mx-auto">
                    Coach utilizes your tasks, schedule, and calendar context.
                  </div>
                  
                  {messages.map((m) => {
                    const isUser = m.sender === 'user';
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                          isUser ? 'bg-primary-950/60 border-primary-500/20' : 'bg-zinc-900 border-zinc-800'
                        }`}>
                          {isUser ? (
                            <User size={14} className="text-primary-400" />
                          ) : (
                            <Bot size={14} className="text-accent-violet" />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`p-3 rounded-2xl text-xs ${
                          isUser 
                            ? 'bg-primary-600 text-white rounded-tr-none' 
                            : 'bg-zinc-900 border border-zinc-800/80 text-zinc-200 rounded-tl-none leading-relaxed'
                        }`}>
                          {m.text.split('\n').map((paragraph: string, idx: number) => (
                            <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Typing Loader */}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-accent-violet" />
                  </div>
                  <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Action Panel */}
            <div className="p-4 border-t border-zinc-900 bg-zinc-950">
              {messages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                  {suggestions.slice(0, 3).map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="shrink-0 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-full text-[10px] text-zinc-400 hover:text-white transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="relative"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask FocusFlow Coach..."
                  disabled={isLoading}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 pl-4 pr-12 text-xs text-white placeholder-zinc-500 transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-2 p-1.5 bg-primary-600 hover:bg-primary-500 disabled:bg-zinc-800 text-white disabled:text-zinc-600 rounded-lg transition-all duration-200"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
