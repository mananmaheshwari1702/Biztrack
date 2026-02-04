import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTasks, faExclamationCircle, faClock, faCheck } from '@fortawesome/free-solid-svg-icons';

interface TaskStatsCardProps {
    overdue: number;
    pending: number;
    completed: number;
}

const TaskStatsCard: React.FC<TaskStatsCardProps> = ({ overdue, pending, completed }) => {
    const activeTotal = overdue + pending;

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between min-h-[140px] md:min-h-[152px] shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200">
            <div className="flex justify-between items-start gap-4 mb-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                        Tasks
                    </p>
                    <p className="text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
                        {activeTotal}
                        <span className="text-sm font-normal text-slate-400 ml-1.5">active</span>
                    </p>
                </div>
                <div
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600"
                    aria-hidden
                >
                    <FontAwesomeIcon icon={faTasks} className="text-lg md:text-xl" />
                </div>
            </div>
            {/* Compact single-row breakdown */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                    <FontAwesomeIcon icon={faExclamationCircle} className="text-[10px]" />
                    {overdue} overdue
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                    <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                    {pending} due soon
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                    {completed} done
                </span>
            </div>
        </div>
    );
};

export default TaskStatsCard;
