import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Search, 
  Wrench, 
  CreditCard, 
  XCircle,
  Camera,
  Share2,
  FileText
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// --- Types ---

interface InspectionPoint {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  status: 'ok' | 'warning' | 'info';
  title: string;
  description: string;
  image?: string;
}

interface ComponentStatus {
  name: string;
  score: number; // 1-10
  status: 'perfect' | 'good' | 'fair' | 'poor';
  wear: number; // 0-1 (0 = new)
  notes: string;
}

interface OrderData {
  id: string;
  status: string;
  bike: {
    id: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    image_url: string;
    condition_grade: string; // A, B, C
  };
  inspection: {
    verdict: string;
    radar_data: { subject: string; A: number; fullMark: number }[];
    components: Record<string, ComponentStatus>;
    points: InspectionPoint[];
    maintenance: { km: number; task: string; urgency: 'low' | 'medium' | 'high' }[];
  };
}

// --- Mocks ---

const MOCK_DATA: OrderData = {
  id: '1001',
  status: 'verified',
  bike: {
    id: 'b1',
    brand: 'Specialized',
    model: 'S-Works Tarmac SL7',
    year: 2022,
    price: 8500,
    image_url: 'https://images.unsplash.com/photo-1571333250630-f0230c320b6d?q=80&w=2070&auto=format&fit=crop',
    condition_grade: 'A'
  },
  inspection: {
    verdict: 'Велосипед в состоянии, близком к новому. Рама проверена ультразвуком — скрытых дефектов нет. Трансмиссия имеет минимальный износ (цепь < 0.5%). Рекомендуется к покупке.',
    radar_data: [
      { subject: 'Рама', A: 10, fullMark: 10 },
      { subject: 'Трансмиссия', A: 9, fullMark: 10 },
      { subject: 'Тормоза', A: 10, fullMark: 10 },
      { subject: 'Колеса', A: 8, fullMark: 10 },
      { subject: 'Косметика', A: 9, fullMark: 10 },
    ],
    components: {
      'Frame': { name: 'Рама & Вилка', score: 10, status: 'perfect', wear: 0, notes: 'Без сколов и трещин. Геометрия в норме.' },
      'Drivetrain': { name: 'Трансмиссия (Dura-Ace)', score: 9, status: 'good', wear: 0.15, notes: 'Четкое переключение. Звезды без износа.' },
      'Brakes': { name: 'Тормозная система', score: 10, status: 'perfect', wear: 0.1, notes: 'Колодки 80% остаток. Роторы ровные.' },
      'Wheels': { name: 'Колеса (Roval)', score: 8, status: 'good', wear: 0.2, notes: 'Микро-царапина на заднем ободе (косметика). Подшипники плавные.' },
    },
    points: [
      { id: 'p1', x: 45, y: 40, status: 'ok', title: 'Рулевой стакан', description: 'Люфтов нет, подшипники смазаны.' },
      { id: 'p2', x: 75, y: 65, status: 'warning', title: 'Задний обод', description: 'Поверхностная царапина 2мм. Карбон не задет.', image: 'https://images.unsplash.com/photo-1599557276327-775677a2d73c?w=500&auto=format&fit=crop&q=60' },
      { id: 'p3', x: 25, y: 70, status: 'ok', title: 'Каретка', description: 'Вращение плавное, без посторонних звуков.' }
    ],
    maintenance: [
      { km: 500, task: 'Смазка цепи', urgency: 'medium' },
      { km: 2000, task: 'Замена тормозных колодок', urgency: 'low' },
      { km: 5000, task: 'Полное ТО вилки', urgency: 'low' }
    ]
  }
};

// --- Components ---

const RadarSection = ({ data }: { data: any[] }) => (
  <div className="h-[300px] w-full flex items-center justify-center">
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
        <Radar
          name="Bike"
          dataKey="A"
          stroke="#10b981"
          strokeWidth={2}
          fill="#10b981"
          fillOpacity={0.2}
        />
      </RadarChart>
    </ResponsiveContainer>
  </div>
);

const DefectMap = ({ image, points }: { image: string; points: InspectionPoint[] }) => {
  const [activePoint, setActivePoint] = useState<InspectionPoint | null>(null);

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-100 shadow-inner group">
      <img src={image} alt="Bike Map" className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
      <div className="absolute inset-0 bg-black/5" />
      
      {points.map((p) => (
        <button
          key={p.id}
          className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-150 ${
            p.status === 'ok' ? 'bg-green-500' : p.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          onClick={() => setActivePoint(p)}
        />
      ))}

      <AnimatePresence>
        {activePoint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-lg p-4 shadow-xl z-10 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                {activePoint.status === 'ok' ? <CheckCircle className="w-4 h-4 text-green-500" /> : 
                 activePoint.status === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> :
                 <Info className="w-4 h-4 text-blue-500" />}
                {activePoint.title}
              </h4>
              <button onClick={() => setActivePoint(null)}><XCircle className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-600 mb-2">{activePoint.description}</p>
            {activePoint.image && (
              <img src={activePoint.image} alt="Defect" className="w-full h-32 object-cover rounded-md" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeepDiveItem = ({ item }: { item: ComponentStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors px-2"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            item.score >= 9 ? 'bg-green-500' : item.score >= 7 ? 'bg-blue-500' : 'bg-yellow-500'
          }`} />
          <span className="font-medium text-gray-900">{item.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-gray-900">{item.score}/10</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-2 pl-7 text-sm text-gray-600 space-y-2">
              <p>{item.notes}</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gray-900 rounded-full" 
                    style={{ width: `${(1 - item.wear) * 100}%` }} 
                  />
                </div>
                <span className="text-xs text-gray-400">Ресурс: {Math.round((1 - item.wear) * 100)}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function InspectionReport() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrderData | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    // Simulate Fetch
    const fetchData = async () => {
      setLoading(true);
      await new Promise(r => setTimeout(r, 1500)); // Fake delay
      
      // In real implementation:
      // const res = await axios.get(`/api/v1/crm/orders/${orderId}`);
      // setData(transformBackendData(res.data));
      
      // Use Mock
      if (orderId) {
        setData({ ...MOCK_DATA, id: orderId });
      }
      setLoading(false);
    };
    
    fetchData();
  }, [orderId]);

  const handleConfirm = () => {
    // Proceed to checkout or payment
    // In real app: navigate(`/checkout/${orderId}`);
    toast.success("Переходим к оплате...");
    setTimeout(() => {
        // Mock redirect
        window.location.href = `http://localhost:5173/checkout/${orderId}`;
    }, 1000);
  };

  const handleReject = () => {
    setShowRejectDialog(false);
    toast.info("Запрос на возврат отправлен. Средства вернутся в течение 15 минут.");
    // Call backend API to cancel order and refund
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col gap-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="mt-auto">
          <p className="text-center text-sm text-gray-500 animate-pulse">Инспектор формирует отчет...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-10 text-center">Ошибка загрузки данных</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-32 md:pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <span className="font-bold text-gray-900 tracking-tight">DIGITAL PASSPORT</span>
        </div>
        <Badge variant="outline" className="font-mono">#{data.id}</Badge>
      </div>

      <div className="max-w-3xl mx-auto">
        
        {/* Hero */}
        <div className="bg-white p-6 pb-8 rounded-b-3xl shadow-sm mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{data.bike.brand} {data.bike.model}</h1>
              <p className="text-gray-500 text-sm mt-1">{data.bike.year} • {data.bike.price} €</p>
            </div>
            <div className="flex flex-col items-end">
              <div className="bg-green-100 text-green-800 font-bold text-2xl px-3 py-1 rounded-lg">
                {data.bike.condition_grade}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-green-700 font-bold mt-1">Grade</span>
            </div>
          </div>

          <DefectMap image={data.bike.image_url} points={data.inspection.points} />
          
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
               <FileText className="w-24 h-24" />
            </div>
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Вердикт Инспектора
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed italic">
              "{data.inspection.verdict}"
            </p>
          </div>
        </div>

        {/* Radar & Analysis */}
        <div className="px-4 space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-400" />
                Технический анализ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadarSection data={data.inspection.radar_data} />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Детализация узлов</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Object.values(data.inspection.components).map((comp, i) => (
                <DeepDiveItem key={i} item={comp} />
              ))}
            </CardContent>
          </Card>

          {/* Maintenance Roadmap */}
          <Card className="border-none shadow-sm bg-gray-900 text-white overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" /> {/* Clock icon needs import or replacement */}
                Maintenance Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 relative z-10">
                {data.inspection.maintenance.map((m, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 text-right font-mono text-gray-400 text-sm">{m.km}km</div>
                    <div className="w-2 h-2 rounded-full bg-gray-600 relative">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-800 -z-10 last:hidden" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{m.task}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        m.urgency === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {m.urgency === 'high' ? 'High Priority' : 'Routine'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Decision Center (Sticky Footer) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Задаток защищен</span>
            <span>Возврат в 1 клик</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-12 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowRejectDialog(true)}
            >
              Отказаться
            </Button>
            <Button 
              className="h-12 bg-gray-900 hover:bg-black text-white shadow-lg shadow-gray-900/20"
              onClick={handleConfirm}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Оплатить
            </Button>
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить бронирование?</DialogTitle>
            <DialogDescription>
              Мы мгновенно вернем задаток 2% на карту, с которой производилась оплата.
              <br /><br />
              <strong>Причина:</strong> Велосипед не соответствует ожиданиям.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:gap-0">
            <Button variant="destructive" onClick={handleReject} className="w-full sm:w-auto">
              Да, вернуть деньги
            </Button>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)} className="w-full sm:w-auto">
              Я передумал
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper for icon (Clock was missing in imports)
function Clock({ className }: { className?: string }) {
  return (
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
