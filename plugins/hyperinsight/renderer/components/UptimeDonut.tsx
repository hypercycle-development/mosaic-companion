import React from 'react';

interface UptimeDonutProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
}

export const UptimeDonut: React.FC<UptimeDonutProps> = ({ percentage, size = 42, strokeWidth = 3 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    
    const color = percentage > 98 ? 'text-emerald-500' : percentage > 90 ? 'text-yellow-500' : 'text-red-500';

    return (
        <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    className="text-[var(--surfaceAlt)]"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <span className={`text-[9px] font-bold ${color}`}>
                    {percentage.toFixed(0)}%
                </span>
            </div>
        </div>
    );
};
