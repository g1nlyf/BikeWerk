import { useState, useEffect } from 'react';
import { LayoutDashboard, Search, Settings, Bike, ClipboardList, Bell, User, BarChart2, FlaskConical, Target } from 'lucide-react';
import { InspectionPage } from './InspectionPage';
import HunterDashboard from '../HunterDashboard';
import AdminHeader from './AdminHeader';
import TheLab from './TheLab';
import { apiGet, apiPost } from '../../api';
import { Copy, MessageCircle, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle, XCircle, RefreshCw, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const AdminMobileDashboard = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'inspection' | 'stats' | 'business' | 'audit' | 'settings' | 'lab' | 'chat' | 'hunter'>('hunter');

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-24 pt-16">
      {/* Header */}
      <AdminHeader />

      {/* Dynamic Content */}
      <div className="p-4">
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'inspection' && <InspectionPage />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'business' && <BusinessAnalyticsView />}
        {activeTab === 'audit' && <AIAuditView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'lab' && <TheLab />}
        {activeTab === 'chat' && <LiveChatView />}
        {activeTab === 'hunter' && <HunterDashboard />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-xl border-t border-white/10 pb-safe pt-2 px-6 overflow-x-auto z-50">
        <div className="flex justify-between items-center min-w-[450px] mx-auto h-16 gap-4">
          <NavButton active={activeTab === 'hunter'} onClick={() => setActiveTab('hunter')} icon={<Target size={20} />} label="Hunter" />
          <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={20} />} label="Заказы" />
          <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageCircle size={20} />} label="Chat" />
          <NavButton active={activeTab === 'inspection'} onClick={() => setActiveTab('inspection')} icon={<Search size={20} />} label="Инспекция" />
          <NavButton active={activeTab === 'lab'} onClick={() => setActiveTab('lab')} icon={<FlaskConical size={20} />} label="Lab" />
          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 size={20} />} label="Stats" />
          <NavButton active={activeTab === 'business'} onClick={() => setActiveTab('business')} icon={<TrendingUp size={20} />} label="Biz" />
          <NavButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<CheckCircle size={20} />} label="Audit" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
        </div>
      </div>
    </div>
  );
};

const LiveChatView = () => {
    const [chats, setChats] = useState<any[]>([]);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);

    const loadChats = async () => {
        const res = await apiGet('/admin/chats');
        if (res.success) {
            setChats(res.chats || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadChats();
        const interval = setInterval(loadChats, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleReply = async () => {
        if (!replyText.trim() || !selectedChat) return;
        
        await apiPost(`/admin/chats/${selectedChat.user_id}/reply`, { text: replyText });
        setReplyText('');
        // Optimistic update locally? 
        // We just reload for now as history is in blob
        loadChats();
        
        // Update selected chat blob manually to show immediate feedback if needed, 
        // but reloading list is safer to sync with server logic
    };

    // If chat selected, show conversation
    if (selectedChat) {
        // Parse history blob
        const historyLines = (selectedChat.last_context || '').split('\n').filter((l: string) => l.trim());
        
        return (
            <div className="flex flex-col h-[80vh] animate-appear-zoom">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => setSelectedChat(null)} className="p-2 bg-white/10 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="font-bold">User #{selectedChat.user_id}</h2>
                        <div className="text-xs text-gray-400">Score: {selectedChat.sentiment_score?.toFixed(2)}</div>
                    </div>
                </div>

                <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 p-4 overflow-y-auto space-y-3 mb-4">
                    {historyLines.length === 0 && <div className="text-center text-gray-500">История пуста</div>}
                    {historyLines.map((line: string, i: number) => {
                        const isUser = line.startsWith('User:');
                        const text = line.replace(/^(User:|Assistant:|Assistant: \[Admin\])/, '').trim();
                        const isAdmin = line.includes('[Admin]');
                        
                        return (
                            <div key={i} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                    isUser 
                                        ? 'bg-white/10 text-white rounded-tl-none' 
                                        : isAdmin 
                                            ? 'bg-purple-600 text-white rounded-tr-none border border-purple-400'
                                            : 'bg-blue-600 text-white rounded-tr-none'
                                }`}>
                                    {text}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Ответ оператора..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                    />
                    <button onClick={handleReply} className="p-2 bg-blue-600 rounded-full text-white">
                        <Send size={20} />
                    </button>
                </div>
            </div>
        )
    }

    // List of chats
    if (loading) return <div>Загрузка чатов...</div>;

    return (
        <div className="space-y-4 animate-appear-zoom">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Live Chat</h1>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">{chats.length} active</span>
            </div>

            <div className="space-y-2">
                {chats.map(chat => (
                    <div 
                        key={chat.user_id}
                        onClick={() => setSelectedChat(chat)}
                        className="bg-white/5 border border-white/10 p-4 rounded-xl active:scale-95 transition-all cursor-pointer flex justify-between items-center"
                    >
                        <div>
                            <div className="font-bold flex items-center gap-2">
                                User #{chat.user_id}
                                {chat.sentiment_score < 0.4 && <AlertTriangle size={14} className="text-red-500" />}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {chat.last_context ? chat.last_context.split('\n').pop() : 'No messages'}
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500">
                            {new Date(chat.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BusinessAnalyticsView = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const res = await apiGet('/admin/stats/business');
      if (res.success) setData(res.stats);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-white/10 rounded w-1/2"></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-white/10 rounded-2xl"></div>
        <div className="h-24 bg-white/10 rounded-2xl"></div>
      </div>
      <div className="h-48 bg-white/10 rounded-2xl"></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-appear-zoom">
      <h1 className="text-2xl font-bold">Бизнес-аналитика</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
          <div className="text-xs text-blue-400 mb-1">Conversion Rate</div>
          <div className="text-2xl font-bold text-blue-300">{data?.conversionRate}%</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl">
          <div className="text-xs text-purple-400 mb-1">AI Accuracy</div>
          <div className="text-2xl font-bold text-purple-300">{data?.aiAccuracy}%</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
          <div className="text-xs text-red-400 mb-1">Refund Risk</div>
          <div className="text-2xl font-bold text-red-300">{data?.refundRiskRate}%</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
          <div className="text-xs text-green-400 mb-1">Revenue (Est)</div>
          <div className="text-2xl font-bold text-green-300">€12.4k</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-sm font-bold mb-4 text-gray-300">Распределение Rank</h3>
        <div className="flex items-end gap-2 h-32">
            {data?.rankDistribution?.map((d: any, i: number) => {
                const max = Math.max(...data.rankDistribution.map((x:any) => x.value));
                const h = max > 0 ? (d.value / max) * 100 : 0;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-blue-500/50 rounded-t" style={{ height: `${h}%` }}></div>
                        <span className="text-[10px] text-gray-500">{d.name}</span>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
};

const AIAuditView = () => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [auditStatus, setAuditStatus] = useState<'idle' | 'saving'>('idle');

    useEffect(() => {
        const load = async () => {
            const res = await apiGet('/admin/audit/pending');
            if (res.success) setTasks(res.tasks || []);
            setLoading(false);
        };
        load();
    }, []);

    const handleVerdict = async (verdict: 'agree' | 'correct', correction?: string) => {
        if (tasks.length === 0) return;
        const bike = tasks[currentIdx];
        setAuditStatus('saving');
        
        try {
            await apiPost(`/admin/audit/${bike.id}/resolve`, { 
                verdict, 
                correction: verdict === 'correct' ? correction : undefined 
            });
            
            // Remove from list or go to next
            const next = tasks.filter((_, i) => i !== currentIdx);
            setTasks(next);
            if (currentIdx >= next.length) setCurrentIdx(0);
            
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(50);

        } catch (e) {
            console.error(e);
        } finally {
            setAuditStatus('idle');
        }
    };

    if (loading) return <div className="p-8 text-center">Загрузка задач...</div>;
    if (tasks.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-bold">Все проверено!</h2>
            <p className="text-gray-400">Нет байков, требующих аудита.</p>
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-blue-400">
                <RefreshCw size={16} /> Обновить
            </button>
        </div>
    );

    const bike = tasks[currentIdx];

    return (
        <div className="space-y-4 animate-appear-zoom h-[80vh] flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold">Аудит ИИ ({tasks.length})</h1>
                <span className="text-xs bg-white/10 px-2 py-1 rounded">Bike #{bike.id}</span>
            </div>

            <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                <div className="h-48 bg-black relative">
                     {/* Image placeholder or real image if available */}
                     <img src={bike.main_image || "/placeholder-bike.svg"} className="w-full h-full object-contain" />
                     <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
                        {bike.model}
                     </div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs text-gray-400">Вердикт ИИ</div>
                            <div className={`text-2xl font-bold ${bike.initial_quality_class === 'A' ? 'text-green-400' : 'text-yellow-400'}`}>
                                Class {bike.initial_quality_class || '?'}
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-xs text-gray-400">Цена</div>
                             <div className="text-xl font-bold">{bike.price} €</div>
                        </div>
                    </div>
                    <div className="bg-black/30 p-3 rounded-xl text-sm text-gray-300 mb-4">
                        {bike.description ? bike.description.slice(0, 150) + '...' : 'Нет описания'}
                    </div>
                </div>
                
                <div className="p-4 bg-black/20 grid grid-cols-2 gap-3">
                    <button 
                        disabled={auditStatus === 'saving'}
                        onClick={() => handleVerdict('correct', bike.initial_quality_class === 'A' ? 'B' : 'A')} // Simple toggle for now, ideal implies modal
                        className="py-3 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500/30 transition-colors"
                    >
                        Исправить
                    </button>
                    <button 
                        disabled={auditStatus === 'saving'}
                        onClick={() => handleVerdict('agree')}
                        className="py-3 bg-green-500/20 text-green-400 rounded-xl font-bold hover:bg-green-500/30 transition-colors"
                    >
                        Согласен
                    </button>
                </div>
            </div>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${
      active ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
    }`}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const StatsView = () => {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiGet('/admin/stats/daily');
        if (res.success) {
          setStats(res.stats);
          setLogs(res.logs || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="text-center p-8">Загрузка...</div>;

  return (
    <div className="space-y-6 animate-appear-zoom">
      <h1 className="text-2xl font-bold">Статистика за сегодня</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
          <div className="text-sm text-green-400 mb-1">Добавлено</div>
          <div className="text-3xl font-bold text-green-300">{stats?.added_today || 0}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
          <div className="text-sm text-red-400 mb-1">Удалено</div>
          <div className="text-3xl font-bold text-red-300">{stats?.deleted_today || 0}</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h2 className="text-lg font-bold mb-4">Логи AutoHunter</h2>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-sm">Нет записей</div>
          ) : (
            logs.map((log: any, i: number) => (
              <div key={i} className="text-xs border-b border-white/5 last:border-0 pb-2 last:pb-0">
                <div className="text-gray-400 mb-1">{new Date(log.ts).toLocaleTimeString()}</div>
                <div>{log.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Placeholder Views
const OrdersView = () => {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (bikeId: number) => {
    setIsGenerating(true);
    setCopied(false);
    try {
      const res = await apiPost('/admin/generate-negotiation', { bikeId, context: 'initial' });
      if (res.success) {
        setGeneratedMessage(res.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (selectedOrder) {
    return (
      <div className="space-y-4 animate-appear-zoom">
        <button 
          onClick={() => { setSelectedOrder(null); setGeneratedMessage(''); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft size={20} />
          Назад к списку
        </button>

        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex justify-between mb-4">
            <span className="font-mono text-xs text-gray-400">#{selectedOrder.id}</span>
            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">Ожидает оплаты</span>
          </div>
          <h2 className="text-xl font-bold mb-2">{selectedOrder.bike}</h2>
          <div className="text-sm text-gray-400 mb-6">
            Покупатель: {selectedOrder.customer}<br/>
            Сумма: {selectedOrder.price}
          </div>

          {/* Contact Seller Block */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MessageCircle size={20} className="text-blue-400" />
              Связаться с продавцом
            </h3>
            
            <div className="bg-blue-500/10 rounded-xl p-4 mb-4">
              <div className="text-sm text-blue-300 mb-2">
                AI-Переговорщик (Human-Style)
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Генерирует сообщение в стиле "Kleinanzeigen" (Du, сленг, коротко).
              </p>
              
              <button 
                onClick={() => handleGenerate(selectedOrder.bikeId)}
                disabled={isGenerating}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isGenerating ? 'Генерация...' : 'Сгенерировать запрос (DE)'}
              </button>
            </div>

            {generatedMessage && (
              <div className="relative group">
                <div className="absolute top-2 right-2">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    title="Копировать"
                  >
                    {copied ? <span className="text-green-400 text-xs font-bold">Скопировано!</span> : <Copy size={16} />}
                  </button>
                </div>
                <pre className="bg-black/50 p-4 rounded-xl text-sm font-mono text-gray-300 whitespace-pre-wrap border border-white/10">
                  {generatedMessage}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-appear-zoom">
      <h1 className="text-2xl font-bold mb-6">Активные заказы</h1>
      {[
        { id: 'ORD-7721', bike: 'Canyon Ultimate CF SLX', customer: 'Иван Петров', price: '120,000 ₽', bikeId: 1 },
        { id: 'ORD-7722', bike: 'Trek Fuel EX 9.8', customer: 'Анна Сидорова', price: '340,000 ₽', bikeId: 2 },
        { id: 'ORD-7723', bike: 'Specialized Tarmac SL7', customer: 'Максим Волков', price: '510,000 ₽', bikeId: 3 }
      ].map((order, i) => (
        <div 
          key={i} 
          onClick={() => setSelectedOrder(order)}
          className="p-4 bg-white/5 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
        >
          <div className="flex justify-between mb-2">
            <span className="font-mono text-xs text-gray-400">{order.id}</span>
            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">Ожидает оплаты</span>
          </div>
          <div className="font-bold">{order.bike}</div>
          <div className="text-sm text-gray-400 mt-1">{order.customer} • {order.price}</div>
        </div>
      ))}
    </div>
  );
};

const SettingsView = () => (
  <div className="space-y-6 animate-appear-zoom">
    <h1 className="text-2xl font-bold">Настройки</h1>
    
    <div className="bg-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="text-gray-400" />
          <span>Уведомления</span>
        </div>
        <div className="w-10 h-6 bg-blue-600 rounded-full relative">
          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="text-gray-400" />
          <span>Профиль</span>
        </div>
        <div className="text-gray-400 text-sm">Admin</div>
      </div>
    </div>

    <button className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-medium">
      Выйти
    </button>
  </div>
);
