import React, { useState } from 'react';
import { AdminMobileLayout } from '@/layouts/AdminMobileLayout';
import { InspectionPage } from '@/pages/AdminDashboard/InspectionPage';
import { SettingsPage } from '@/pages/AdminDashboard/SettingsPage';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('inspection');

  const renderContent = () => {
    switch (activeTab) {
      case 'inspection': return <InspectionPage />;
      case 'settings': return <SettingsPage />;
      default: return <InspectionPage />;
    }
  };

  return (
    <AdminMobileLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AdminMobileLayout>
  );
}
