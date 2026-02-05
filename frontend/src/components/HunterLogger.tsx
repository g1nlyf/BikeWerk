import { useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const HunterLogger = () => {
  const lastLogIdRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/hunter/logs`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.success || !data.logs) return;

        // Sort by id ascending (oldest to newest) to print in order
        const logs = data.logs.sort((a: any, b: any) => a.id - b.id);
        
        // Filter new logs
        const newLogs = logs.filter((log: any) => log.id > lastLogIdRef.current);
        
        if (newLogs.length > 0) {
          // Update last ID
          lastLogIdRef.current = newLogs[newLogs.length - 1].id;
          
          newLogs.forEach((log: any) => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            let style = 'color: #888';
            let icon = 'ℹ️';
            
            if (log.status === 'success' || log.action?.includes('SUCCESS')) {
              style = 'color: #4caf50; font-weight: bold';
              icon = '✅';
            } else if (log.status === 'error' || log.action?.includes('ERROR') || log.action?.includes('REJECTION')) {
              style = 'color: #f44336; font-weight: bold';
              icon = '❌';
            } else if (log.status === 'warning') {
              style = 'color: #ff9800';
              icon = '⚠️';
            }

            console.log(
              `%c[Hunter ${timestamp}] ${icon} ${log.action}`,
              style,
              log.details ? log.details : ''
            );
          });
        }
      } catch (error) {
        // Silent fail to not pollute console with fetch errors if server is down
      }
    };

    // Initial fetch
    fetchLogs();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchLogs, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null; // This component renders nothing visually
};
