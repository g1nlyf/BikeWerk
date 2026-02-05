import React from 'react';
import { User, LogOut, Bell, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="pt-2 space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>
      
      <div className="space-y-4">
        <section className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4 flex items-center gap-4 border-b border-white/5">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
              A
            </div>
            <div>
              <div className="font-semibold">Admin User</div>
              <div className="text-xs text-gray-400">admin@eubike.com</div>
            </div>
          </div>
          
          <div className="p-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left">
              <User size={20} className="text-gray-400" />
              <span>Редактировать профиль</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left">
              <Bell size={20} className="text-gray-400" />
              <span>Уведомления</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left">
              <Shield size={20} className="text-gray-400" />
              <span>Безопасность</span>
            </button>
          </div>
        </section>

        <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-red-400 font-medium active:scale-95 transition-transform">
          <LogOut size={20} />
          Выйти из системы
        </button>
      </div>
      
      <div className="text-center text-xs text-gray-600">
        EUBike Admin Mobile v1.0.0<br/>
        Build 2025.07.14
      </div>
    </div>
  );
};
