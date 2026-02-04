import React, { useState, useRef } from 'react';
import { Server, Database, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const formatNumber = (num: number) => {
    return num.toLocaleString('en-US').replace(/,/g, ',');
};

const RollingCounter = ({ 
    primary, 
    secondary, 
    label, 
    secondaryLabel,
    primaryIcon: PrimaryIcon,
    secondaryIcon: SecondaryIcon,
    primaryColorClass,
    secondaryColorClass
}: { 
    primary: number; 
    secondary: number; 
    label: string; 
    secondaryLabel: string;
    primaryIcon: any;
    secondaryIcon: any;
    primaryColorClass: string;
    secondaryColorClass: string;
}) => {
    const [offset, setOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        if (containerRef.current) {
            containerRef.current.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        }
        setOffset(1); // Scroll to secondary
    };

    const handleMouseLeave = () => {
        // Scroll to the duplicate primary (index 2)
        if (containerRef.current) {
            containerRef.current.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        }
        setOffset(2);
    };

    const handleTransitionEnd = () => {
        setIsAnimating(false);
        if (offset === 2) {
            // Instantly reset to 0 without animation when we reach the duplicate
            if (containerRef.current) {
                containerRef.current.style.transition = 'none';
                // Force reflow
                void containerRef.current.offsetHeight;
                setOffset(0);
            }
        }
    };

    return (
        <div 
            className="relative h-[24px] overflow-hidden cursor-default"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={containerRef}
                className="flex flex-col gap-0 ease-in-out"
                style={{ transform: `translateY(-${offset * 24}px)` }}
                onTransitionEnd={handleTransitionEnd}
            >
                {/* 0: Primary (Nodes) */}
                <div className="h-[24px] flex items-center justify-start whitespace-nowrap leading-none">
                    <PrimaryIcon size={16} className={`mr-2 ${primaryColorClass}`} />
                    <span className="font-bold text-gray-200">{formatNumber(primary)}</span>
                    <span className="ml-1 text-gray-400">{label}</span>
                </div>
                
                {/* 1: Secondary (Licenses) */}
                <div className="h-[24px] flex items-center justify-start whitespace-nowrap leading-none">
                    <SecondaryIcon size={16} className={`mr-2 ${secondaryColorClass}`} />
                    <span className="font-bold text-gray-200">{formatNumber(secondary)}</span>
                    <span className="ml-1 text-gray-400">{secondaryLabel}</span>
                </div>

                {/* 2: Primary Duplicate (for looping) */}
                <div className="h-[24px] flex items-center justify-start whitespace-nowrap leading-none">
                    <PrimaryIcon size={16} className={`mr-2 ${primaryColorClass}`} />
                    <span className="font-bold text-gray-200">{formatNumber(primary)}</span>
                    <span className="ml-1 text-gray-400">{label}</span>
                </div>
            </div>
        </div>
    );
};

interface MetricBadgeProps {
    primaryValue: number;
    secondaryValue: number;
    label: string;
    secondaryLabel?: string;
    historyData?: any[];
    primaryIcon: any;
    secondaryIcon: any;
    primaryColorClass: string;
    secondaryColorClass: string;
}

const MetricBadge = ({ 
    primaryValue, 
    secondaryValue, 
    label, 
    secondaryLabel, 
    historyData, 
    primaryIcon,
    secondaryIcon,
    primaryColorClass,
    secondaryColorClass
}: MetricBadgeProps) => {
    let trend = 'flat'; // 'up' | 'down' | 'flat'

    if (historyData && historyData.length >= 2) {
        // Use primaryValue (current stats) instead of the last history point
        const current = primaryValue;
        // Compare against the previous full day (second to last point)
        const prev = historyData[historyData.length - 2].value;
        
        if (current > prev) trend = 'up';
        else if (current < prev) trend = 'down';
    }

    return (
        <div className="flex items-center space-x-3 text-sm font-mono border border-gray-700 rounded-md px-3 py-1.5 bg-gray-800/50 backdrop-blur-sm h-[38px]">
            <div className="flex items-center space-x-2">
                <RollingCounter 
                    primary={primaryValue} 
                    secondary={secondaryValue} 
                    label={label}
                    secondaryLabel={secondaryLabel || ""}
                    primaryIcon={primaryIcon}
                    secondaryIcon={secondaryIcon}
                    primaryColorClass={primaryColorClass}
                    secondaryColorClass={secondaryColorClass}
                />
            </div>
             <div className="flex items-center pl-2 border-l border-gray-700 h-full space-x-1">
                {trend === 'up' && <ArrowUpRight size={16} className="text-emerald-500" />}
                {trend === 'down' && <ArrowDownRight size={16} className="text-red-500" />}
                {trend === 'flat' && <Minus size={16} className="text-gray-500" />}
            </div>
        </div>
    );
};

export const ActiveNodesDisplay = ({ stats, history }: { stats: any, history: any }) => {
    return (
        <div className="flex items-center space-x-4">
             <span className="text-sm font-mono text-gray-400 font-bold">Node Activity |</span>
             <MetricBadge 
                primaryValue={stats?.totalActiveNodes || 0}
                secondaryValue={stats?.totalActiveLicenses || 0}
                label="(24h)"
                secondaryLabel="Licenses"
                historyData={history?.activeNodes}
                primaryIcon={Server}
                secondaryIcon={Database}
                primaryColorClass="text-emerald-500"
                secondaryColorClass="text-blue-500"
             />
             <MetricBadge 
                primaryValue={stats?.totalDeployedNodes || 0}
                secondaryValue={stats?.totalDeployedLicenses || 0}
                label="(7d)"
                secondaryLabel="Licenses"
                historyData={history?.deployedNodes}
                primaryIcon={Server}
                secondaryIcon={Database}
                primaryColorClass="text-emerald-500"
                secondaryColorClass="text-blue-500"
             />
        </div>
    );
};
