import React, { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';

const Sparkline = ({ data }: { data: any[] }) => {
    // Show last 7 days as requested
    const last7 = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.slice(-7).map(d => d.value);
    }, [data]);

    if (last7.length < 2) return null;

    // Buffer/Padding
    const padding = 5;
    // Internal coordinate system (0-100)
    const height = 100;
    const width = 100;
    
    const min = Math.min(...last7);
    const max = Math.max(...last7);
    const range = max - min || 1; // Avoid division by zero

    // Calculate Trend Color
    const isGrowth = last7[last7.length - 1] >= last7[0];
    const colorClass = isGrowth ? 'text-[var(--success)]' : 'text-[var(--danger)]';

    const points = last7.map((val, i) => {
        // Apply horizontal padding logic within 0-100 coordinate space
        const availableWidth = width - (padding * 2);
        const x = padding + (i / (last7.length - 1)) * availableWidth;
        // Invert Y because SVG coordinate system origin is top-left
        const y = height - ((val - min) / range) * height; 
        return `${x},${y}`;
    }).join(' ');
    
    return (
        // Container controls height, width is responsive (w-full)
        // h-12 (48px) as requested
        <div className="h-12 w-full">
            <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${width} ${height}`} 
                preserveAspectRatio="none"
                className="overflow-visible"
            >
                {/* Sparkline Path */}
                <polyline 
                    points={points} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    className={colorClass}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

interface MetricCardProps {
    title: string;
    value: string | number;
    chartData?: any[];
    subtext?: string;
    tooltipText?: string;
}

export const MetricCard = ({ title, value, chartData, subtext, tooltipText = "default text" }: MetricCardProps) => {
    return (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 flex flex-col h-full relative group">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h3 className="text-[var(--textMuted)] text-sm font-medium">{title}</h3>
                    <div className="text-2xl font-bold text-[var(--text)] mt-1">{value}</div>
                    {subtext && <div className="text-xs text-[var(--textMuted)] mt-1">{subtext}</div>}
                </div>
                
                {/* Help Icon with Tooltip */}
                <div className="relative group/tooltip">
                    <div className="p-2 rounded-lg text-[var(--textMuted)] hover:text-[var(--text)] transition-colors cursor-help">
                        <HelpCircle size={14} />
                    </div>
                    {/* Tooltip Popup - Moved to Top */}
                    <div className="absolute right-0 bottom-full mt-2 w-72 p-2 bg-[var(--background)] border border-[var(--border)] rounded shadow-xl text-xs text-[var(--text)] z-50 opacity-0 group-hover/tooltip:opacity-85 transition-opacity pointer-events-none group-hover/tooltip:pointer-events-auto">
                        {tooltipText}
                    </div>
                </div>
            </div>
            
            {/* Chart pushed to bottom */}
            <div className="mt-auto w-full pt-2">
                {chartData && chartData.length > 0 && <Sparkline data={chartData} />}
            </div>
        </div>
    );
};
