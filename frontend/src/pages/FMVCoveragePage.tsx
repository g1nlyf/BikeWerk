
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/api';
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface CoverageItem {
    brand: string;
    model: string;
    records: number;
    avg_price: number;
    last_updated: string;
    quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT';
}

interface CoverageData {
    total_brands: number;
    total_models: number;
    coverage: CoverageItem[];
}

export default function FMVCoveragePage() {
    const [data, setData] = useState<CoverageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await apiGet('/fmv/coverage');
            if (result && result.coverage) {
                setData(result);
            } else {
                setError('Invalid data format received');
            }
        } catch (e) {
            setError('Failed to fetch coverage data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getBadgeVariant = (quality: string) => {
        switch (quality) {
            case 'EXCELLENT': return 'default'; // primary
            case 'HIGH': return 'secondary';
            case 'MEDIUM': return 'outline';
            case 'LOW': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <BikeflipHeaderPX />
            
            <main className="flex-grow container mx-auto py-8 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold">FMV Coverage Dashboard</h1>
                        <p className="text-gray-500">Market History Analysis & Data Quality</p>
                    </div>
                    <Button onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {error && (
                    <div className="bg-red-100 text-red-800 p-4 rounded-md mb-6 flex items-center">
                        <AlertCircle className="mr-2 h-5 w-5" />
                        {error}
                    </div>
                )}

                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Total Brands</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.total_brands}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Total Models</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.total_models}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Data Points</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.coverage.reduce((acc, item) => acc + item.records, 0)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Coverage by Model</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading && !data ? (
                            <div className="text-center py-8">Loading analysis...</div>
                        ) : data?.coverage.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No market data collected yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3">Brand / Model</th>
                                            <th className="px-6 py-3">Records</th>
                                            <th className="px-6 py-3">Avg Price</th>
                                            <th className="px-6 py-3">Quality</th>
                                            <th className="px-6 py-3">Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data?.coverage.map((item, idx) => (
                                            <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    <div className="font-bold">{item.brand}</div>
                                                    <div className="text-gray-500">{item.model}</div>
                                                </td>
                                                <td className="px-6 py-4">{item.records}</td>
                                                <td className="px-6 py-4">€{item.avg_price}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={getBadgeVariant(item.quality)}>
                                                        {item.quality}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {new Date(item.last_updated).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
            
            <Footer />
        </div>
    );
}
