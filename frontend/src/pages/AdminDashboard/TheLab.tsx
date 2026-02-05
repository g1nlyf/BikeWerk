import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Terminal, 
  Activity, 
  Search, 
  RefreshCw, 
  DollarSign, 
  BarChart, 
  Trash2,
  CheckCircle,
  AlertTriangle,
  Lock,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth';
import { apiPost, apiGet } from '@/api';

interface TestCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  testType: string;
  isRunning: boolean;
  lastRun?: Date | null;
  onRun: (type: string) => void;
}

const TestCard: React.FC<TestCardProps> = ({ 
  title, 
  description, 
  icon, 
  testType, 
  isRunning, 
  lastRun, 
  onRun 
}) => (
  <Card className="p-4 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-white/20 bg-white/40 backdrop-blur-sm">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      {icon}
    </div>
    
    <div className="flex flex-col h-full justify-between space-y-4">
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <div className="p-2 rounded-lg bg-white/80 shadow-sm text-gray-800">
            {icon}
          </div>
          <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs text-gray-500 font-mono">
          {lastRun ? `Last: ${lastRun.toLocaleTimeString()}` : 'Never run'}
        </div>
        <Button 
          size="sm" 
          onClick={() => onRun(testType)}
          disabled={isRunning}
          className={`
            transition-all duration-300 shadow-md
            ${isRunning ? 'bg-gray-400' : 'bg-black hover:bg-gray-800'}
          `}
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Play className="w-4 h-4 mr-1" />
          )}
          {isRunning ? 'Running...' : 'Run Now'}
        </Button>
      </div>
    </div>
  </Card>
);

const TheLab: React.FC = () => {
  const { token, login, logout, user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [runningTests, setRunningTests] = useState<Record<string, boolean>>({});
  const [lastRuns, setLastRuns] = useState<Record<string, Date>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Log polling state
  const [isPollingLogs, setIsPollingLogs] = useState(false);
  const processedLogsRef = useRef<number>(0);
  
  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const ts = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [...prev, `[${ts}] ${prefix} ${msg}`]);
  };

  // Poll for logs when running long tests
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPollingLogs) {
        interval = setInterval(async () => {
            try {
                const res: any = await apiGet('/admin/tests/logs');
                if (Array.isArray(res)) {
                    // Backend resets logs on new test run, so if we get fewer logs, reset counter
                    if (res.length < processedLogsRef.current) processedLogsRef.current = 0;
                    
                    const newLogs = res.slice(processedLogsRef.current);
                    if (newLogs.length > 0) {
                        newLogs.forEach((l: any) => {
                             const text = l.text || JSON.stringify(l);
                             addLog(text); 
                             if (text.includes('Test Finished') || text.includes('Test Failed')) {
                                 setIsPollingLogs(false);
                             }
                        });
                        processedLogsRef.current = res.length;
                    }
                }
            } catch (e) {
                console.error("Log polling error", e);
            }
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPollingLogs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    const res = await login(email, password);
    setIsLoggingIn(false);
    
    if (res.success) {
      addLog('Logged in successfully', 'success');
    } else {
      setLoginError(res.error || 'Login failed');
      addLog(`Login failed: ${res.error}`, 'error');
    }
  };

  const runTest = async (testType: string) => {
    if (runningTests[testType]) return;

    if (!token) {
      addLog('Authentication required. Please login.', 'error');
      return;
    }

    setRunningTests(prev => ({ ...prev, [testType]: true }));
    addLog(`Starting test: ${testType}...`);

    if (testType === 'auto_hunt' || testType === 'cleaner') {
        setIsPollingLogs(true);
        processedLogsRef.current = 0;
    }

    try {
      const res: any = await apiPost('/admin/tests/run', { testType });

      if (res.error === 'Invalid token' || res.error === 'Access token required') {
         addLog(`Auth Failed: ${res.error}. Please re-login.`, 'error');
      } else if (res.success) {
        addLog(res.message, 'success');
        if (res.details) {
          addLog(JSON.stringify(res.details, null, 2));
        }
        if (res.logs && Array.isArray(res.logs)) {
            res.logs.forEach((l: any) => addLog(typeof l === 'string' ? l : l.text));
        }
      } else {
        addLog(`Failed: ${res.error || 'Unknown error'}`, 'error');
      }

      setLastRuns(prev => ({ ...prev, [testType]: new Date() }));
    } catch (error: any) {
      addLog(`Network Error: ${error.message}`, 'error');
    } finally {
      setRunningTests(prev => ({ ...prev, [testType]: false }));
    }
  };

  const tests = [
    {
      id: 'auto_hunt',
      title: 'Auto-Hunt Test',
      description: 'Run /test_autocat for 3 bikes (Gemini Selection, Photos, Save).',
      icon: <Search className="w-5 h-5" />
    },
    {
      id: 'quality_check',
      title: 'Quality Check Test',
      description: 'Run AIInspector on a random bike from DB.',
      icon: <CheckCircle className="w-5 h-5" />
    },
    {
      id: 'cleaner',
      title: 'Cleaner Test',
      description: 'Run cleanupDeadLinks() for active bikes.',
      icon: <Trash2 className="w-5 h-5" />
    },
    {
      id: 'financial_sync',
      title: 'Financial Sync',
      description: 'Force update exchange rate and prices.',
      icon: <DollarSign className="w-5 h-5" />
    },
    {
      id: 'ranking_recalc',
      title: 'Ranking Recalc',
      description: 'Recalculate Ranking 2.0 for all bikes.',
      icon: <BarChart className="w-5 h-5" />
    }
  ];

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="bg-red-500/10 p-4 rounded-full">
            <Lock className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-gray-400">Please login to access the Lab.</p>
        
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white/5 p-6 rounded-xl border border-white/10">
            <div>
                <Input 
                    placeholder="Email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="bg-black/50 border-white/20"
                />
            </div>
            <div>
                <Input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="bg-black/50 border-white/20"
                />
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoggingIn}>
                {isLoggingIn ? 'Logging in...' : 'Login'}
            </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
                {user?.name?.[0] || 'A'}
            </div>
            <div>
                <h3 className="font-bold">{user?.name || 'Admin'}</h3>
                <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout()} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map(t => (
          <TestCard
            key={t.id}
            title={t.title}
            description={t.description}
            icon={t.icon}
            testType={t.id}
            isRunning={!!runningTests[t.id]}
            lastRun={lastRuns[t.id]}
            onRun={runTest}
          />
        ))}
      </div>

      {/* Console */}
      <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#1e1e1e] shadow-2xl">
        <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-mono text-gray-300">Real-time Logs</span>
          </div>
          <button 
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
        <div 
          ref={scrollRef}
          className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1"
        >
          {logs.length === 0 && (
            <div className="text-gray-600 italic">Ready to run tests...</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300 break-all border-l-2 border-transparent hover:border-gray-600 pl-2">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TheLab;
