import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface StatsCardProps {
    title: string;
    value: number | string;
    icon: IconDefinition;
    color: string;
    trend?: string;
}

const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
};

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, trend }) => {
    const iconBgClass = colorClasses[color] ?? 'bg-slate-100 text-slate-600';

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between min-h-[140px] md:min-h-[152px] shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200">
            <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                        {title}
                    </p>
                    <p className="text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
                        {value}
                    </p>
                    {trend && (
                        <p className="text-xs text-slate-400 mt-2 font-medium">
                            {trend}
                        </p>
                    )}
                </div>
                <div
                    className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}
                    aria-hidden
                >
                    <FontAwesomeIcon icon={icon} className="text-lg md:text-xl" />
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
