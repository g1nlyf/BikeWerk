import React from 'react';
import { LayoutDashboard, ClipboardCheck, Settings } from 'lucide-react';

interface AdminMobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminMobileLayout: React.FC<AdminMobileLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Заказы', icon: LayoutDashboard },
    { id: 'inspection', label: 'Инспекция', icon: ClipboardCheck },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20 font-['Manrope']">
      <div className="p-4">
        {children}
      </div>
      
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/40 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4 z-50 pb-4">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
