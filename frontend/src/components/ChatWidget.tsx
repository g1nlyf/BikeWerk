import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, User } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../api';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

const LOG_PREFIX = '[ChatWidget]';

const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [mounted, setMounted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const rootElRef = useRef<HTMLDivElement | null>(null);
    const buttonElRef = useRef<HTMLButtonElement | null>(null);

    const log = (...args: unknown[]) => {
        console.log(LOG_PREFIX, ...args);
    };

    // Init Session
    useEffect(() => {
        setMounted(true);
        let storedSession = localStorage.getItem('chat_session_id');
        if (!storedSession) {
            storedSession = Math.floor(Math.random() * 1000000).toString();
            localStorage.setItem('chat_session_id', storedSession);
        }
        setSessionId(storedSession);
    }, []);

    // Polling for updates (e.g. Admin replies)
    useEffect(() => {
        if (!sessionId || !isOpen) return;

        const poll = async () => {
            try {
                const url = `${API_BASE}/chat/history?sessionId=${sessionId}`;
                const res = await axios.get(url);
                if (res.data.history) {
                    // Parse history
                    const lines = res.data.history.split('\n').filter((l: string) => l.trim());
                    const parsedMessages: Message[] = lines.map((line: string, i: number) => {
                        const isUser = line.startsWith('User:');
                        const text = line.replace(/^(User:|Assistant:|Assistant: \[Admin\])/, '').trim();
                        // Simple heuristic for ID: index
                        return {
                            id: `hist-${i}`,
                            text,
                            sender: isUser ? 'user' : 'bot',
                            timestamp: new Date() // We don't have real timestamp in blob
                        };
                    });

                    // If we have more messages in history than local state, update
                    // This is a naive sync but works for this text-blob based backend
                    setMessages(prev => {
                        if (parsedMessages.length > prev.length) {
                            return parsedMessages;
                        }
                        // Check if last message is different (e.g. admin reply)
                        const lastLocal = prev[prev.length - 1];
                        const lastRemote = parsedMessages[parsedMessages.length - 1];
                        if (lastLocal?.text !== lastRemote?.text) {
                            return parsedMessages;
                        }
                        return prev;
                    });
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        };

        const interval = setInterval(poll, 5000);
        poll(); // Initial call
        return () => clearInterval(interval);
    }, [sessionId, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, isOpen]);

    useLayoutEffect(() => {
        if (!mounted) return;
        // Keep layout logs minimal or remove in production
    });

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            // Ensure we use the correct API base URL
            const url = `${API_BASE}/chat/message`;
            log('send message request', { url });
            const response = await axios.post(url, {
                text: userMsg.text,
                sessionId: sessionId
            });

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: response.data.text,
                sender: 'bot',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            log('send message error', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Извините, я сейчас не могу ответить. Попробуйте позже.",
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div
            id="chat-widget-root"
            ref={(el) => { rootElRef.current = el; }}
            className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[999999] flex flex-col items-end font-sans"
        >
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="mb-4 md:mb-6 w-[min(420px,calc(100vw-32px))] h-[min(680px,calc(100vh-140px))] flex flex-col overflow-hidden rounded-[32px] border border-border/60 shadow-2xl bg-background/80 backdrop-blur-2xl"
                    >
                        {/* Premium Header */}
                        <div className="relative overflow-hidden px-6 pt-6 pb-4 border-b border-border/50">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 opacity-70 blur-xl"></div>
                            <div className="relative z-10 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 p-[2px]">
                                            <div className="w-full h-full rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                                                <img src="/minilogo1.png" alt="AI" className="w-full h-full object-cover opacity-90" onError={(e) => e.currentTarget.src = 'https://ui-avatars.com/api/?name=Bike+Werk&background=random'} />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background shadow-[0_0_10px_rgba(16,185,129,0.55)] animate-pulse"></div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground tracking-tight">Ваш Вело-Консьерж</h3>
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-3 h-3 text-emerald-400" />
                                            <p className="text-xs text-muted-foreground font-medium">Expert AI • Online</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-transparent">
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-center px-4 mt-8 space-y-4"
                                >
                                    <div className="inline-block p-4 rounded-2xl bg-muted/40 border border-border/60 backdrop-blur-md">
                                        <p className="text-sm text-foreground/90 leading-relaxed">
                                            Привет! Я ваш персональный вело-эксперт. <br />
                                            Спросите меня о чем угодно: от нюансов навески <span className="text-emerald-400">Shimano GRX</span> до сроков доставки в ваш регион.
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Я знаю всё о байках в нашем каталоге</p>
                                </motion.div>
                            )}

                            {messages.map((msg) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.sender === 'bot' && (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-border/60 flex items-center justify-center mr-2 mt-1 shrink-0">
                                            <img src="/minilogo1.png" className="w-5 h-5 opacity-80" alt="Bot" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] p-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm backdrop-blur-sm ${msg.sender === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-tr-none shadow-[0_6px_20px_rgba(0,0,0,0.18)]'
                                                : 'bg-muted/50 text-foreground border border-border/60 rounded-tl-none'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                    {msg.sender === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-muted/40 border border-border/60 flex items-center justify-center ml-2 mt-1 shrink-0">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-border/60 flex items-center justify-center shrink-0">
                                        <img src="/minilogo1.png" className="w-5 h-5 opacity-80" alt="Bot" />
                                    </div>
                                    <div className="bg-muted/40 border border-border/60 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-background/70 border-t border-border/50 backdrop-blur-xl">
                            <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-full px-4 py-2.5 focus-within:bg-muted/60 focus-within:border-border focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-300">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Спросите о доставке или подборе..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isTyping}
                                    className={`p-2 rounded-full transition-all duration-300 ${inputValue.trim()
                                            ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-[0_0_18px_rgba(16,185,129,0.25)] hover:shadow-[0_0_24px_rgba(16,185,129,0.35)] transform hover:scale-105'
                                            : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
                                        }`}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-center mt-3">
                                <a
                                    href="https://t.me/EUBikeBot"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-emerald-600/90 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1.5 group"
                                >
                                    <span>Перейти в Telegram для сохранения истории</span>
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    log('toggle click', { before: isOpen, after: !isOpen });
                    setIsOpen(!isOpen);
                }}
                ref={(el) => { buttonElRef.current = el; }}
                className="group relative"
            >
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className="relative bg-background/80 border border-border/60 text-foreground p-4 rounded-full shadow-2xl flex items-center justify-center overflow-hidden backdrop-blur-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    {isOpen ? <X className="w-6 h-6 relative z-10" /> : <MessageCircle className="w-6 h-6 relative z-10" />}
                </div>
                {!isOpen && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background"></div>
                )}
            </motion.button>
        </div>,
        document.body
    );
};

// Helper Icon
const ArrowRight = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

export default ChatWidget;
