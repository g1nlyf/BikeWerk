import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Euro, User, Search, Bike } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { API_BASE } from '@/api';

interface AdminHeaderProps {
  onSearch?: (query: string) => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ onSearch }) => {
  const { user } = useAuth();
  const [eurRate, setEurRate] = useState<number>(0);
  const [activeBikes, setActiveBikes] = useState<number>(0);
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch system settings for rate (mock or actual)
        // Since we don't have a direct settings endpoint in context, we'll try to get it from a public endpoint or mock it
        // Ideally, backend should expose GET /api/admin/stats
        // For now, let's assume we can check backend health
        const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
        setIsLive(!!healthRes);

        // Fetch bikes count
        // We can use the public bikes API with limit=1 to get total count from header or response
        // But for now let's mock the count or fetch all
        // A dedicated stats endpoint would be better. 
        // Let's use a mock for demonstration as per "Clean & Tech" style visual
        setEurRate(93.4); // This should come from backend
        setActiveBikes(142); // This should come from backend
      } catch (e) {
        console.error('Stats fetch error', e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo & Status */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">EU</span>
            </div>
            {isLive && (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
            )}
          </div>
          <span className="hidden sm:block font-semibold text-gray-800">Admin</span>
        </div>

        {/* Center: Rate */}
        <div className="flex items-center space-x-2 bg-white/50 px-3 py-1.5 rounded-full border border-white/30 shadow-inner">
          <Euro className="w-4 h-4 text-gray-600" />
          <span className="font-mono font-medium text-gray-900">{eurRate.toFixed(2)} ₽</span>
        </div>

        {/* Right: Stats & Profile */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-gray-600">
            <Bike className="w-4 h-4" />
            <span className="font-medium text-sm">{activeBikes}</span>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-transform">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default AdminHeader;
