import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Camera } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export interface InspectionItem {
  id: string;
  name: string;
  status: 'ok' | 'issue' | 'warning';
  comment?: string;
  images?: string[];
}

export interface InspectionReportProps {
  bikeId: string;
  items: InspectionItem[];
  overallStatus: 'passed' | 'failed' | 'conditional';
  inspectorName: string;
  date: string;
}

export const InspectionReport: React.FC<InspectionReportProps> = ({
  items,
  overallStatus,
  inspectorName,
  date,
}) => {
  const getStatusIcon = (status: InspectionItem['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'issue':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getOverallBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Проверка пройдена</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Не пройдена</Badge>;
      case 'conditional':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">С замечаниями</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold">Отчет о проверке</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Инспектор: {inspectorName} • {new Date(date).toLocaleDateString()}
          </p>
        </div>
        {getOverallBadge(overallStatus)}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(item.status)}
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.images && item.images.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                        <Camera className="w-4 h-4" />
                        {item.images.length} фото
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <div className="grid grid-cols-2 gap-4">
                        {item.images.map((img, idx) => (
                          <img key={idx} src={img} alt={`${item.name} ${idx + 1}`} className="w-full h-auto rounded-lg" />
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {item.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 pl-8">
                  {item.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
