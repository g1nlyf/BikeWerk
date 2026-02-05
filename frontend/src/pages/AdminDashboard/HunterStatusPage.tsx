import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Search, ShieldAlert, Zap, Clock, Database, Server, RefreshCw, Check, Info, AlertTriangle, Filter, Target } from "lucide-react";
import { apiGet, apiPost } from "@/api";
import AdminHeader from './AdminHeader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';

function ActivityChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-muted-foreground">No activity data</div>;
  
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
                cursor={{ fill: '#334155', opacity: 0.2 }}
            />
            <Bar dataKey="found" name="Found" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="added" name="Added" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RejectionChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-muted-foreground">No rejections recorded</div>;

    const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981'];

    return (
        <div className="h-64 w-full flex flex-col md:flex-row items-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 p-4 text-xs">
                {data.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HunterStatusPage() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await apiGet('/admin/hunter/stats');
      const logsRes = await apiGet('/admin/hunter/logs');
      
      if (statsRes.success) setStats(statsRes);
      if (logsRes.success) setLogs(logsRes.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleEmergencyHunt = async () => {
    setTriggering(true);
    try {
      await apiPost('/admin/labs/hunt-trigger', {});
      // Refresh logs after a delay
      setTimeout(fetchData, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setTriggering(false);
    }
  };

  const funnelData = stats?.data?.funnel || { found: 0, passedFilter: 0, aiAnalyzed: 0, published: 0 };
  const rejectionData = stats?.data?.rejections || [];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Hunter Dashboard" />
      
      <main className="container mx-auto p-4 md:p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hunter Status</h1>
            <p className="text-muted-foreground">Real-time monitoring of Autonomous Hunter v3.1</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="destructive" onClick={handleEmergencyHunt} disabled={triggering}>
              <Zap className="w-4 h-4 mr-2" />
              {triggering ? 'Triggering...' : 'Emergency Hunt'}
            </Button>
          </div>
        </div>

        {/* Top KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Search className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Всего найдено</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{funnelData.found}</div>
                </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Filter className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Прошли фильтр</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{funnelData.passedFilter}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {funnelData.found > 0 ? ((funnelData.passedFilter / funnelData.found) * 100).toFixed(1) : 0}% conv.
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">AI Обработано</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{funnelData.aiAnalyzed}</div>
                </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Опубликовано</span>
                    </div>
                    <div className="text-3xl font-bold text-green-400">{funnelData.published}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                         Active in Catalog
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Воронка конверсии (7 дней)</CardTitle>
              <CardDescription>Динамика поиска и добавления в каталог</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.weeklyActivity && <ActivityChart data={stats.weeklyActivity} />}
            </CardContent>
          </Card>

          {/* Rejection Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Причины отсева</CardTitle>
              <CardDescription>Почему Hunter отвергает объявления</CardDescription>
            </CardHeader>
            <CardContent>
                <RejectionChart data={rejectionData} />
            </CardContent>
          </Card>
        </div>

        {/* FMV Analysis Block */}
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-white">FMV Intelligence</CardTitle>
                    <CardDescription>Аналитика оценки стоимости</CardDescription>
                </div>
                <Badge variant="outline" className="border-green-500 text-green-500">Live Model v3.0</Badge>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded bg-slate-950/50 border border-slate-800">
                        <div className="text-xs text-muted-foreground mb-1">Средняя маржинальность</div>
                        <div className="text-2xl font-bold text-green-400">32.5%</div>
                        <p className="text-xs text-slate-500 mt-2">Target: &gt;25%</p>
                    </div>
                    <div className="p-4 rounded bg-slate-950/50 border border-slate-800">
                        <div className="text-xs text-muted-foreground mb-1">Точность оценки (Confidence)</div>
                        <div className="text-2xl font-bold text-blue-400">88%</div>
                        <p className="text-xs text-slate-500 mt-2">Based on Gemini 2.0 Flash</p>
                    </div>
                    <div className="p-4 rounded bg-slate-950/50 border border-slate-800">
                        <div className="text-xs text-muted-foreground mb-1">Снайперских попаданий</div>
                        <div className="text-2xl font-bold text-yellow-400">12</div>
                        <p className="text-xs text-slate-500 mt-2">Last 24 hours</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* System Logs */}
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-white">Live Activity Logs</CardTitle>
                        <CardDescription>Поток событий в реальном времени</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-500">Online</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="space-y-0 max-h-[500px] overflow-y-auto">
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                            <div className="min-w-[80px] text-xs font-mono text-slate-500 pt-1">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded 
                                        ${log.status === 'success' ? 'bg-green-500/10 text-green-400' : 
                                          log.status === 'error' ? 'bg-red-500/10 text-red-400' : 
                                          log.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : 
                                          'bg-blue-500/10 text-blue-400'}`}>
                                        {log.action.split(':')[0]}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 font-mono">
                                    {log.details || log.action}
                                </p>
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            Waiting for hunter events...
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default HunterStatusPage;
