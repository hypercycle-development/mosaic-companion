import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const AimTrendChart = ({ data, isLoading, metric }: { data: any[], isLoading: boolean, metric: string }) => {
    const isDark = true; // Always dark mode in this view

    if (isLoading) return <div className="h-64 flex items-center justify-center text-gray-500 font-mono animate-pulse">Loading chart data...</div>;
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-500 font-mono">No historical data available</div>;

    const formattedData = data.map(d => ({
        ...d,
        timestamp: new Date(d.bucket).getTime(),
        dateStr: new Date(d.bucket).toLocaleString()
    }));

    return (
        <div className="h-96 w-full bg-gray-800/30 rounded-xl border border-gray-700 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                    <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isDark ? "#3b82f6" : "#2563eb"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isDark ? "#3b82f6" : "#2563eb"} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} vertical={false} />
                    <XAxis 
                        dataKey="timestamp" 
                        stroke={isDark ? "#9ca3af" : "#6b7280"} 
                        tick={{fontSize: 11, fontFamily: 'monospace'}} 
                        tickFormatter={(unix) => new Date(unix).toLocaleDateString()}
                        type="number"
                        domain={['auto', 'auto']}
                        scale="time"
                    />
                    <YAxis 
                        stroke={isDark ? "#9ca3af" : "#6b7280"} 
                        tick={{fontSize: 11, fontFamily: 'monospace'}} 
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: isDark ? '#111827' : '#ffffff', 
                            borderColor: isDark ? '#374151' : '#e5e7eb', 
                            color: isDark ? '#f3f4f6' : '#111827', 
                            fontFamily: 'monospace'
                        }}
                        labelFormatter={(unix) => new Date(unix).toLocaleString()}
                        itemStyle={{color: isDark ? '#60a5fa' : '#2563eb'}}
                    />
                    <Area 
                        type="monotone" 
                        dataKey={metric} 
                        stroke={isDark ? "#3b82f6" : "#2563eb"} 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorMetric)" 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
