import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const AimTrendChart = ({ data, isLoading, metric }: { data: any[], isLoading: boolean, metric: string }) => {
    if (isLoading) return <div className="h-64 flex items-center justify-center text-[var(--textMuted)] font-mono animate-pulse">Loading chart data...</div>;
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-[var(--textMuted)] font-mono">No historical data available</div>;

    const formattedData = data.map(d => ({
        ...d,
        timestamp: new Date(d.bucket).getTime(),
        dateStr: new Date(d.bucket).toLocaleString()
    }));

    return (
        <div className="h-96 w-full bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                    <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                        dataKey="timestamp" 
                        stroke="var(--textMuted)" 
                        tick={{fontSize: 11, fontFamily: 'monospace'}} 
                        tickFormatter={(unix) => new Date(unix).toLocaleDateString()}
                        type="number"
                        domain={['auto', 'auto']}
                        scale="time"
                    />
                    <YAxis 
                        stroke="var(--textMuted)" 
                        tick={{fontSize: 11, fontFamily: 'monospace'}} 
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: 'var(--surface)', 
                            borderColor: 'var(--border)', 
                            color: 'var(--text)', 
                            fontFamily: 'monospace'
                        }}
                        labelFormatter={(unix) => new Date(unix).toLocaleString()}
                        itemStyle={{color: 'var(--primary)'}}
                    />
                    <Area 
                        type="monotone" 
                        dataKey={metric} 
                        stroke="var(--primary)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorMetric)" 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
