import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ShieldAlert, Activity, DollarSign, Target, TrendingUp,
  Terminal, Zap, StopCircle, RefreshCw, FlaskConical, Scale
} from 'lucide-react';
import { apiGet, apiPost } from '@/api';
import { useAuth } from '@/context/AuthContext';

// SECURITY: Admin access now requires JWT token with admin role
// The x-admin-secret header is deprecated - use Authorization header instead

export default function AdminEmperor() {
  const { user, token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [scoring, setScoring] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthError('Требуется авторизация');
      setLoading(false);
      return;
    }
    if (user?.role !== 'admin') {
      setAuthError('Доступ только для администраторов');
      setLoading(false);
      return;
    }
    setAuthError(null);
  }, [isAuthenticated, user]);

  const fetchAll = async () => {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [s, a, f, sc] = await Promise.all([
        apiGet('/admin/system/status', { headers }),
        apiGet('/admin/analytics/market', { headers }),
        apiGet('/admin/finance/summary', { headers }),
        apiGet('/admin/scoring/config', { headers })
      ]);
      setStatus(s);
      setAnalytics(a);
      setFinance(f);
      setScoring(sc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 30000);
    return () => clearInterval(timer);
  }, []);

  const toggleLabTest = async (testId: string, enabled: boolean) => {
    if (!token) return;
    try {
      await apiPost('/admin/labs/toggle-ab', { test_id: testId, enabled }, { headers: { 'Authorization': `Bearer ${token}` } });
      alert(`Test ${testId} ${enabled ? 'Enabled' : 'Disabled'}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Show auth error if not admin
  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-500 font-mono text-xl">
        {authError}
      </div>
    );
  }

  if (loading && !status) return <div className="flex h-screen items-center justify-center bg-slate-950 text-white font-mono animate-pulse">INITIALIZING WAR ROOM PROTOCOLS...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-red-500/30">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <ShieldAlert className="h-10 w-10 text-red-600" />
            The War Room
          </h1>
          <p className="text-slate-500 font-medium font-mono text-sm tracking-widest mt-1">EMPEROR LEVEL ACCESS // EUBIKE AUTONOMOUS CORE</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-green-900/20 text-green-500 border-green-500/30 px-3 py-1 font-mono">
            <Activity className="h-3 w-3 mr-2 animate-pulse" />
            SYSTEM OPERATIONAL
          </Badge>
          <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 hover:bg-slate-800" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> REFRESH
          </Button>
          <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20">
            <StopCircle className="h-4 w-4 mr-2" /> KILL SWITCH
          </Button>
        </div>
      </div>

      {/* Main Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Fleet"
          value={status?.status?.bikes || 0}
          sub="Live Listings"
          icon={<Zap className="text-yellow-500" />}
          trend="+12% this week"
        />
        <StatCard
          title="Supply Gaps"
          value={status?.status?.search_abandons || 0}
          sub="Missed Opportunities"
          icon={<Target className="text-red-500" />}
          trend="Critical"
        />
        <StatCard
          title="Projected Revenue"
          value={`€${(finance?.summary?.gross_revenue || 0).toLocaleString()}`}
          sub="Gross Volume"
          icon={<DollarSign className="text-green-500" />}
          trend="+5% vs Target"
        />
        <StatCard
          title="Net Margin"
          value={`${finance?.summary?.projected_margin || 0}%`}
          sub="Profitability"
          icon={<TrendingUp className="text-purple-500" />}
          trend="Healthy"
        />
      </div>

      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full flex justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800">🏛 Overview</TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-slate-800">💰 Financial (Zone A)</TabsTrigger>
          <TabsTrigger value="hunter" className="data-[state=active]:bg-slate-800">🛰 Hunter (Zone B)</TabsTrigger>
          <TabsTrigger value="market" className="data-[state=active]:bg-slate-800">📈 Market (Zone C)</TabsTrigger>
          <TabsTrigger value="labs" className="data-[state=active]:bg-slate-800">🧪 Labs (Zone D)</TabsTrigger>
          <TabsTrigger value="arbiter" className="data-[state=active]:bg-slate-800">⚖️ Arbiter (Zone E)</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white">Live Activity Feed</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {(status?.logs || []).slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex gap-3 items-start p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${log.level === 'ERROR' ? 'bg-red-500' : log.level === 'WARN' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-sm font-mono text-slate-300">{log.message}</p>
                        <p className="text-xs text-slate-600 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white">Priority Targets</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics?.priorities || {}).slice(0, 5).map(([cat, score]: any) => (
                    <div key={cat} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800">
                      <span className="text-white font-medium">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${Math.min(score * 10, 100)}%` }} />
                        </div>
                        <span className="text-xs text-red-400 font-mono">{score.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Profit Simulator</CardTitle>
              <CardDescription>Real-time Unit Economics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <p className="text-slate-500 text-sm uppercase">Total Inventory Value</p>
                  <p className="text-4xl font-black text-white mt-2">€{(finance?.summary?.inventory_value || 0).toLocaleString()}</p>
                </div>
                <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <p className="text-slate-500 text-sm uppercase">Potential Net Profit</p>
                  <p className="text-4xl font-black text-green-500 mt-2">€{(finance?.summary?.potential_profit || 0).toLocaleString()}</p>
                </div>
                <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <p className="text-slate-500 text-sm uppercase">Margin Health</p>
                  <p className="text-4xl font-black text-purple-500 mt-2">{finance?.summary?.projected_margin || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hunter">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white">Infrastructure Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Status</span>
                  <span className="text-green-500 font-bold uppercase">{status?.status?.hunter?.status}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Uptime</span>
                  <span className="text-white font-mono">{Math.floor(status?.status?.hunter?.uptime || 0)}s</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Active Threads</span>
                  <span className="text-white font-mono">{status?.status?.hunter?.active_threads || 1}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white">Active Bounties</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(analytics?.bounties || []).map((b: any) => (
                    <div key={b.id} className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between">
                      <span className="text-white">{b.brand} {b.model}</span>
                      <Badge>€{b.max_price}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="market">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white">Market Inventory Analysis</CardTitle></CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.inventory || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="category" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><FlaskConical /> Behavioral Lab</CardTitle>
              <CardDescription>A/B Testing & Experiments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Test #AB-2024-001: Aggressive Negotiation</p>
                    <p className="text-sm text-slate-500">Uses shorter, more direct initial messages to sellers.</p>
                  </div>
                  <Button onClick={() => toggleLabTest('negotiation_aggressive', true)} variant="outline">Enable</Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Test #AB-2024-002: Dynamic Pricing</p>
                    <p className="text-sm text-slate-500">Adjusts listing price based on hourly view velocity.</p>
                  </div>
                  <Button onClick={() => toggleLabTest('dynamic_pricing', false)} variant="outline">Disable</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arbiter">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Scale /> The Arbiter: Scoring Weights</CardTitle>
              <CardDescription>Adjust the internal valuation logic of the AI.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(scoring?.brandFactors || {}).map(([brand, factor]: any) => (
                  <div key={brand} className="p-3 bg-slate-950 rounded border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase">{brand}</p>
                    <p className="text-xl font-bold text-white">{factor.toFixed(1)}x</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function StatCard({ title, value, sub, icon, trend }: any) {
  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden relative group hover:border-slate-700 transition-all">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform scale-150">{icon}</div>
      <CardHeader className="pb-2">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{title}</p>
      </CardHeader>
      <CardContent>
        <h2 className="text-3xl font-black text-white">{value}</h2>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-slate-400">{sub}</p>
          {trend && <span className="text-xs font-mono text-green-500 bg-green-900/20 px-1 rounded">{trend}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
