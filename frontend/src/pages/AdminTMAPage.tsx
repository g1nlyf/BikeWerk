import React, { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Activity, 
  Euro, 
  MapPin, 
  Settings, 
  Zap, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  Navigation
} from "lucide-react";
import { apiGet, apiPost } from "@/api";
import { toast } from "sonner";

interface SystemStats {
  active: number;
  total: number;
  marburgCount: number;
  potentialProfit: number;
  health: {
    gemini: boolean;
    db: boolean;
  };
}

interface BikeSimple {
  id: number;
  brand: string;
  model: string;
  price: number;
  guaranteed_pickup: boolean;
  main_image?: string;
}

export default function AdminTMAPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [marburgBikes, setMarburgBikes] = useState<BikeSimple[]>([]);
  const [loading, setLoading] = useState(false);
  const [huntPriority, setHuntPriority] = useState([50]); // 0=MTB, 100=Road

  useEffect(() => {
    // Initialize TMA
    if (typeof window !== 'undefined') {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Theme handling
      const isDark = tg.colorScheme === 'dark';
      if (isDark) {
        tg.setHeaderColor('#0f172a');
        tg.setBackgroundColor('#0f172a');
      } else {
        tg.setHeaderColor('#ffffff');
        tg.setBackgroundColor('#ffffff');
      }
      
      // Enable closing confirmation if needed, but for overlay we might want it seamless
      // tg.enableClosingConfirmation();
    }
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // In real implementation, validate initData with backend
      const res = await apiGet('/admin/stats'); // We need to implement this
      if (res) {
        setStats(res);
        setMarburgBikes(res.marburgBikes || []);
      }
    } catch (e) {
      console.error(e);
      // Mock data for UI development if API fails
      setStats({
        active: 129,
        total: 1450,
        marburgCount: 12,
        potentialProfit: 45200,
        health: { gemini: true, db: true }
      });
      setMarburgBikes([
        { id: 1, brand: 'Canyon', model: 'Grizl CF SL', price: 1800, guaranteed_pickup: true },
        { id: 2, brand: 'Specialized', model: 'Tarmac SL7', price: 3200, guaranteed_pickup: true }
      ]);
    }
  };

  const handleForceHunt = async () => {
    WebApp.HapticFeedback.impactOccurred('heavy');
    setLoading(true);
    try {
      await apiPost('/admin/hunt', { priority: huntPriority[0] });
      toast.success("Hunt initiated!");
    } catch (e) {
      toast.error("Failed to start hunt");
    } finally {
      setLoading(false);
    }
  };

  const openMap = (location: string = "Marburg, Germany") => {
    WebApp.openLink(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="bg-white p-4 sticky top-0 z-10 border-b border-gray-100 flex justify-between items-center">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-black" />
          Command Center
        </h1>
        <div className="flex gap-2">
          <Badge variant={stats?.health.gemini ? "default" : "destructive"} className="h-6">
            AI {stats?.health.gemini ? "ON" : "OFF"}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard">Dash</TabsTrigger>
            <TabsTrigger value="hunt">Hunt</TabsTrigger>
            <TabsTrigger value="logistics">Marburg</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center pt-6">
                  <Euro className="w-8 h-8 text-green-600 mb-2" />
                  <div className="text-2xl font-bold">{stats?.potentialProfit.toLocaleString()}€</div>
                  <div className="text-xs text-muted-foreground">Est. Profit</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center pt-6">
                  <Activity className="w-8 h-8 text-blue-600 mb-2" />
                  <div className="text-2xl font-bold">{stats?.active}</div>
                  <div className="text-xs text-muted-foreground">Active Lots</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Gemini AI (Multi-Key)</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Operational</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Database</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Connected</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Proxy Network</span>
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Warn</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hunt" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tactical Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span>MTB Focus</span>
                    <span>Road Focus</span>
                  </div>
                  <Slider 
                    value={huntPriority} 
                    onValueChange={setHuntPriority} 
                    max={100} 
                    step={10} 
                    className="py-4"
                  />
                </div>
                
                <Button 
                  size="lg" 
                  className="w-full bg-black hover:bg-gray-800 text-white h-14 text-lg shadow-xl shadow-black/10"
                  onClick={handleForceHunt}
                  disabled={loading}
                >
                  {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5 fill-yellow-400 text-yellow-400" />}
                  Force Hunt Protocol
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Triggers immediate scan of 15 high-priority targets.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-amber-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Marburg Zone (3h)
              </h2>
              <Badge variant="secondary">{marburgBikes.length} Bikes</Badge>
            </div>
            
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {marburgBikes.map(bike => (
                  <Card key={bike.id} className="overflow-hidden border-amber-100 shadow-sm">
                    <div className="flex">
                      <div className="w-24 bg-gray-100 relative">
                        {bike.main_image && <img src={bike.main_image} className="absolute inset-0 w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 p-3">
                        <div className="font-bold text-sm">{bike.brand} {bike.model}</div>
                        <div className="text-lg font-bold text-amber-600">{bike.price}€</div>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                            onClick={() => openMap()}
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            Route
                          </Button>
                          <Button size="sm" className="h-8 text-xs flex-1 bg-black text-white">
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {marburgBikes.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No active pickups in Marburg zone.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
