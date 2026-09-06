import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, HelpCircle, FileText, ArrowRight, RotateCcw } from 'lucide-react';
import { apiFetch } from '../lib/apiClient.js';
import { Service } from '../types.js';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  provider?: 'gemini' | 'local-knowledge' | 'unavailable';
  isFallback?: boolean;
}

interface AIChatAssistantProps {
  activeService?: Service | null;
}

export default function AIChatAssistant({ activeService }: AIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentServiceContext, setCurrentServiceContext] = useState<Service | null>(activeService || null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: "Hello! I am your EasyDesk AI Digital Assistant. Ask me anything about passport applications, GST registration, Aadhaar, PAN card fees, or check if your documents are valid!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (activeService) {
      setCurrentServiceContext(activeService);
    }
  }, [activeService]);

  // Keep a stable ref for currentServiceContext to avoid listener re-attachment
  const serviceContextRef = React.useRef(currentServiceContext);
  useEffect(() => {
    serviceContextRef.current = currentServiceContext;
  }, [currentServiceContext]);

  // Listen for global custom event to open chat and request contextual help
  useEffect(() => {
    const handleContextEvent = (e: CustomEvent<{ service?: Service; autoSend?: boolean; customPrompt?: string }>) => {
      const { service, autoSend, customPrompt } = e.detail || {};
      if (service) {
        setCurrentServiceContext(service);
      }
      setIsOpen(true);
      if (autoSend && service) {
        const promptText = customPrompt || buildContextualPrompt(service);
        setTimeout(() => {
          handleSend(undefined, promptText, service);
        }, 150);
      }
    };

    window.addEventListener('easydesk-ai-contextual-help' as any, handleContextEvent as any);
    return () => {
      window.removeEventListener('easydesk-ai-contextual-help' as any, handleContextEvent as any);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  const buildContextualPrompt = (s: Service) => {
    return `Can you give me specific contextual filing advice for ${s.title}?
- Required Documents: ${s.requiredDocuments.join(', ')}
- Total Fee: ₹${s.govFees + s.serviceCharge} (Gov: ₹${s.govFees}, Consultancy: ₹${s.serviceCharge})
- Estimated Processing Time: ${s.processingTime}
- Eligibility: ${s.eligibility}

Please provide step-by-step guidance on document preparation, key verification checks, and tips to avoid rejection.`;
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'model',
        content: "Hello! I am your EasyDesk AI Digital Assistant. Ask me anything about passport applications, GST registration, Aadhaar, PAN card fees, or check if your documents are valid!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setCurrentServiceContext(null);
    setInput('');
    setLoading(false);
  };

  const handleSend = async (e?: React.FormEvent, customText?: string, overrideService?: Service | null) => {
    if (e) e.preventDefault();
    const serviceForContext = overrideService !== undefined ? overrideService : currentServiceContext;
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Filter out leading model welcome message so Gemini multiturn history starts with user
    const historyPayload = messages
      .filter((m, idx) => !(idx === 0 && m.role === 'model'))
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: {
          message: textToSend.trim(),
          chatHistory: historyPayload,
          contextService: serviceForContext ? {
            id: serviceForContext.id,
            title: serviceForContext.title,
            govFees: serviceForContext.govFees,
            serviceCharge: serviceForContext.serviceCharge,
            processingTime: serviceForContext.processingTime,
            requiredDocuments: serviceForContext.requiredDocuments,
            eligibility: serviceForContext.eligibility
          } : undefined
        }
      });

      const data = await response.json().catch(() => ({}));
      
      const aiMsg: ChatMessage = {
        role: 'model',
        content: data.text || data.fallbackText || "I am currently unable to process your request. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: data.provider,
        isFallback: data.isFallback
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: "I ran into a connection error. Please verify your network or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'unavailable',
          isFallback: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "What documents are needed for Passport?",
    "How much does PAN card cost?",
    "Udyam registration benefits?",
    "GST application time?"
  ];

  return (
    <div id="ai-chat-assistant-container" className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 font-sans flex flex-col items-end pointer-events-auto">
      {/* Single Sleek Floating Chat Toggle Button */}
      {!isOpen && (
        <button
          id="btn-ai-chat-open"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white p-3 sm:p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group border border-white/20 active:scale-95 cursor-pointer"
          aria-label="Open EasyDesk AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          </div>
          <span className="font-bold text-xs max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap pr-1">
            EasyDesk AI
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          id="ai-chat-window"
          className="w-[calc(100vw-2rem)] sm:w-96 h-[480px] sm:h-[520px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/10 p-1.5 rounded-xl">
                <Bot className="w-5 h-5 text-cyan-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm leading-none">EasyDesk Smart AI</h3>
                  <div className="flex items-center gap-0.5 bg-cyan-400/20 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-cyan-100">
                    <Sparkles className="w-2.5 h-2.5" /> Live
                  </div>
                </div>
                <p className="text-xs text-blue-200 mt-1">Official Digital Concierge</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                id="btn-ai-new-chat"
                onClick={handleResetChat}
                className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1.5 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                title="Start new conversation and reset context"
                aria-label="New Chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-medium">New Chat</span>
              </button>
              <button
                id="btn-ai-chat-close"
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contextual Service Header Bar if active (Dismissible) */}
          {currentServiceContext && (
            <div className="bg-gradient-to-r from-indigo-50 via-cyan-50 to-blue-50 border-b border-indigo-100 p-2 px-3 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                <div className="bg-blue-600 text-white p-1 rounded-lg shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                      Context: {currentServiceContext.title}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  id="btn-ai-contextual-help-header"
                  onClick={() => handleSend(undefined, buildContextualPrompt(currentServiceContext), currentServiceContext)}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Send active service details to AI for tailored filing advice"
                >
                  <Sparkles className="w-3 h-3 text-cyan-300" /> Advice
                </button>
                <button
                  id="btn-ai-context-dismiss"
                  onClick={() => setCurrentServiceContext(null)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1 rounded-lg transition cursor-pointer"
                  title="Dismiss service context and ask general questions"
                  aria-label="Dismiss service context"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {m.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-none markdown-body'
                    }`}
                  >
                    {/* Render basic markdown bolding/bullets since LLM uses markdown */}
                    <div className="whitespace-pre-wrap">
                      {m.content.split('\n').map((line, lIdx) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <strong key={lIdx} className="block mt-1 font-bold">{line.replace(/\*\*/g, '')}</strong>;
                        }
                        if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
                          return <li key={lIdx} className="ml-4 list-disc text-slate-700 mt-1">{line.substring(2)}</li>;
                        }
                        if (line.startsWith('### ')) {
                          return <h4 key={lIdx} className="font-semibold text-slate-900 mt-2 mb-1 border-b border-slate-100 pb-0.5">{line.substring(4)}</h4>;
                        }
                        if (line.startsWith('#### ')) {
                          return <h5 key={lIdx} className="font-bold text-slate-800 mt-1.5 mb-0.5">{line.substring(5)}</h5>;
                        }
                        return <p key={lIdx} className={line ? 'mt-1' : 'h-2'} style={{ minHeight: '4px' }}>{line}</p>;
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1 px-1">
                    {m.role === 'model' && m.provider && (
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        m.provider === 'gemini'
                          ? 'text-cyan-800 bg-cyan-50 border border-cyan-200/60'
                          : m.provider === 'local-knowledge'
                            ? 'text-blue-800 bg-blue-50 border border-blue-200/60'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                      }`}>
                        {m.provider === 'gemini' ? '✨ Gemini AI' : m.provider === 'local-knowledge' ? '📚 Database Knowledge' : '⚡ Offline Mode'}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400 ml-auto">
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 max-w-[80%] mr-auto">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="bg-white p-3 border border-slate-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
            {/* Primary Contextual Help Action Button */}
            {currentServiceContext && (
              <button
                id="btn-ai-contextual-help-prompt"
                onClick={() => handleSend(undefined, buildContextualPrompt(currentServiceContext), currentServiceContext)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs p-2.5 rounded-xl shadow-md flex items-center justify-between transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span className="truncate">Contextual Advice: {currentServiceContext.title}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}

            {messages.length === 1 && (
              <div>
                <p className="text-[10px] text-slate-400 font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Suggested Prompts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(undefined, p)}
                      className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full hover:border-blue-400 hover:text-blue-600 transition text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentServiceContext ? `Ask filing advice for ${currentServiceContext.title}...` : "Ask anything about digital services..."}
              className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              disabled={loading}
            />
            <button
              id="btn-ai-chat-send"
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:scale-100 transition duration-150 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

