import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CheckCircle, Zap, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import axios from 'axios';

interface MarketRecord {
  id: number;
  scraped_at: string;
  brand: string;
  model_name: string;
  price_eur: number;
  source_url: string;
  is_super_deal?: boolean;
}

interface MarketHistoryTableProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POPULAR_BRANDS = ["Canyon", "Specialized", "Cube", "Trek", "Scott", "Giant", "Orbea"];

export const MarketHistoryTable: React.FC<MarketHistoryTableProps> = ({ open, onOpenChange }) => {
  const [data, setData] = useState<MarketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (open) {
      fetchData();
      // Auto-refresh every 30 seconds
      interval = setInterval(fetchData, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [open, selectedBrand]);

  const fetchData = () => {
    // Only set loading on initial fetch or brand change, not on auto-refresh if data exists
    if (data.length === 0) setLoading(true);
    
    const params: any = {};
    if (selectedBrand && selectedBrand !== "all") {
      params.brand = selectedBrand;
    }

    axios.get('/api/market/raw-data', { params })
      .then(res => {
        setData(res.data.data || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
                <DialogTitle>Живой Архив Рынка</DialogTitle>
                <DialogDescription>
                    Сырые данные, собранные системой Silent Collector в реальном времени.
                </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Все бренды" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все бренды</SelectItem>
                    {POPULAR_BRANDS.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border rounded-md">
          {loading ? (
             <div className="space-y-3 p-4">
               {[...Array(6)].map((_, i) => (
                 <div key={i} className="flex items-center space-x-4">
                   <Skeleton className="h-12 w-full" />
                 </div>
               ))}
             </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[180px]">Дата / Время</TableHead>
                  <TableHead>Модель</TableHead>
                  <TableHead>Цена (EU)</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Источник</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {new Date(record.scraped_at).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{record.brand}</span>
                        <span className="text-sm text-gray-500">{record.model_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">{record.price_eur} €</span>
                      {!!record.is_super_deal && (
                        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 border-green-200 gap-1 text-[10px] px-1 py-0 h-5">
                          <Zap className="h-3 w-3 fill-green-800" /> Super Deal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                         <CheckCircle className="h-4 w-4" />
                         Verified by AI
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Badge variant="outline" className="gap-1 ml-auto cursor-pointer hover:bg-gray-100">
                          Kleinanzeigen <ExternalLink className="h-3 w-3" />
                        </Badge>
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
