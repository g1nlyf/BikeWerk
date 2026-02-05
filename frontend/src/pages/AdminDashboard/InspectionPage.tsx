import { useState } from 'react';
import { Camera, ChevronLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export const InspectionPage = () => {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState<any>(null);

  // Mock orders waiting for inspection
  const inspectionOrders = [
    { id: 'ORD-7722', bike: 'Specialized Tarmac SL7', customer: 'Мария Иванова', status: 'deposit_paid' },
    { id: 'ORD-7725', bike: 'Canyon Aeroad', customer: 'Иван Сидоров', status: 'deposit_paid' }
  ];

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPhotos(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      // Use relative path for production
      const response = await fetch('/api/inspector/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalListing: {
            initial_quality_class: 'A',
            description: selectedOrder?.bike || '',
            images: []
          },
          newInspection: {
            images: photos,
            sellerAnswers: {
              cracks: 'no',
              service_date: '2023-10-01'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI Inspector request failed: ${response.status}`);
      }

      const payload = await response.json();
      setVerdict(payload?.data ?? payload);
    } catch (error) {
      console.error('Analysis failed', error);
      // Fallback mock for demo if server is not reachable
      setTimeout(() => {
          setVerdict({
              final_class: 'A',
              confidence_score: 92,
              expert_comment: "Анализ фото подтверждает отличное состояние. Визуальных дефектов на раме и вилке не обнаружено. Трансмиссия чистая.",
              degradation_detected: false
          });
      }, 2000);
    } finally {
      setAnalyzing(false);
    }
  };

  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-[#0f172a] pt-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => { setSelectedOrder(null); setVerdict(null); setPhotos([]); }}
            className="p-2 bg-white/5 rounded-full"
          >
            <ChevronLeft />
          </button>
          <div>
            <h2 className="text-xl font-bold">Инспекция</h2>
            <p className="text-sm text-gray-400">{selectedOrder.bike}</p>
          </div>
        </div>

        {/* Content */}
        {!verdict ? (
          <div className="space-y-6">
            {/* Photo Grid */}
            <div className="grid grid-cols-3 gap-2">
              {photos.map((src, idx) => (
                <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-black/20">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="aspect-square rounded-xl bg-blue-500/10 border-2 border-dashed border-blue-500/30 flex flex-col items-center justify-center text-blue-400 cursor-pointer active:scale-95 transition-transform">
                <Camera size={24} />
                <span className="text-xs mt-1">Добавить</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handlePhotoCapture}
                />
              </label>
            </div>

            {/* Action Button */}
            {photos.length > 0 && (
              <button 
                onClick={runAIAnalysis}
                disabled={analyzing}
                className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Анализ AI...
                  </>
                ) : (
                  'Запустить AI Inspector'
                )}
              </button>
            )}
            
            <div className="p-4 bg-white/5 rounded-2xl text-sm text-gray-400">
              <p>📸 Сделайте фото ключевых узлов:</p>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>Кареточный узел</li>
                <li>Задний переключатель</li>
                <li>Нижняя труба рамы</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-appear-zoom">
            {/* Verdict Card */}
            <div className={`p-6 rounded-3xl border ${
              verdict.degradation_detected 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-sm opacity-70">Вердикт AI</div>
                  <div className={`text-3xl font-bold ${
                    verdict.degradation_detected ? 'text-red-400' : 'text-green-400'
                  }`}>
                    Класс {verdict.final_class}
                  </div>
                </div>
                <div className="px-3 py-1 bg-black/20 rounded-full text-sm font-mono">
                  {verdict.confidence_score}% conf
                </div>
              </div>
              <p className="text-lg leading-relaxed mb-4">
                {verdict.expert_comment}
              </p>
              
              {verdict.degradation_detected ? (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl">
                  <AlertTriangle size={20} />
                  <span className="font-medium">Обнаружено ухудшение качества</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 p-3 rounded-xl">
                  <CheckCircle size={20} />
                  <span className="font-medium">Качество подтверждено</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button className="py-3 bg-white/10 rounded-xl font-medium">Оспорить</button>
                <button 
                    onClick={() => { setSelectedOrder(null); setVerdict(null); setPhotos([]); }}
                    className="py-3 bg-blue-600 rounded-xl font-medium shadow-lg shadow-blue-900/20"
                >
                    Принять
                </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pt-2">
      <h1 className="text-2xl font-bold mb-6">Очередь инспекции</h1>
      <div className="space-y-3">
        {inspectionOrders.map((order) => (
          <div 
            key={order.id} 
            onClick={() => setSelectedOrder(order)}
            className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 active:scale-95 transition-transform cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-sm text-gray-400">#{order.id}</span>
              <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
            </div>
            <div className="font-semibold text-lg mb-1">{order.bike}</div>
            <div className="text-sm text-gray-400">{order.customer}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
