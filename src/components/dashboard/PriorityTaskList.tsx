import React from 'react';
import type { Task } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faChevronRight, faCalendar, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { toUtcIso, formatDisplayDate } from '../../utils/dateUtils';

interface PriorityTaskListProps {
    tasks: Task[];
    onLoadMore?: () => void;
    loading?: boolean;
}

const getPriorityStyles = (priority: string) => {
    switch (priority) {
        case 'High':
            return { card: 'bg-red-50/80 border-red-100 text-red-600', strip: 'bg-red-500' };
        case 'Medium':
            return { card: 'bg-amber-50/80 border-amber-100 text-amber-600', strip: 'bg-amber-500' };
        case 'Low':
            return { card: 'bg-blue-50/80 border-blue-100 text-blue-600', strip: 'bg-blue-500' };
        default:
            return { card: 'bg-slate-50 border-slate-100 text-slate-600', strip: 'bg-slate-500' };
    }
};

const isOverdue = (dateString: string) => {
    const date = new Date(toUtcIso(dateString));
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime();
};

const PriorityTaskList: React.FC<PriorityTaskListProps> = ({ tasks, onLoadMore, loading }) => {
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!onLoadMore) return;
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 80) onLoadMore();
    };

    return (
        <section
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(55vh,480px)]"
            aria-labelledby="priority-tasks-heading"
        >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-shrink-0">
                <h2
                    id="priority-tasks-heading"
                    className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2"
                >
                    <span
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0"
                        aria-hidden
                    >
                        <FontAwesomeIcon icon={faExclamationCircle} className="text-sm" />
                    </span>
                    Priority tasks
                </h2>
                <Link
                    to="/tasks"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-1 rounded-lg px-2 py-1.5 min-h-[36px] inline-flex items-center gap-1 transition-colors"
                >
                    View all
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                </Link>
            </div>

            <div
                className="p-4 md:p-5 overflow-y-auto min-h-0 flex-1"
                onScroll={handleScroll}
            >
                {tasks.length === 0 ? (
                    <div className="py-10 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                            <FontAwesomeIcon icon={faExclamationCircle} className="text-xl" />
                        </div>
                        <p className="text-sm text-slate-500">No pending tasks.</p>
                    </div>
                ) : (
                    <ul className="space-y-3" role="list">
                        {tasks.map((task) => {
                            const { card: cardClass, strip: stripClass } = getPriorityStyles(task.priority);
                            const overdue = isOverdue(task.dueDate);
                            return (
                                <li key={task.id}>
                                    <div
                                        className={`flex items-center gap-3 p-3 rounded-xl border bg-white relative overflow-hidden group hover:shadow-sm transition-shadow ${cardClass}`}
                                    >
                                        <div
                                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${stripClass}`}
                                            aria-hidden
                                        />
                                        <div
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-1 ${cardClass}`}
                                            aria-hidden
                                        >
                                            <FontAwesomeIcon icon={faExclamationCircle} className="text-sm" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-slate-900 text-sm truncate">
                                                    {task.title}
                                                </p>
                                                {overdue && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                        Overdue
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                                                <span>{task.priority}</span>
                                                <span aria-hidden>·</span>
                                                <FontAwesomeIcon icon={faCalendar} className="text-[10px] opacity-75" />
                                                <span>{formatDisplayDate(task.dueDate)}</span>
                                            </p>
                                        </div>
                                        <Link
                                            to="/tasks"
                                            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            aria-label={`View task: ${task.title}`}
                                        >
                                            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                                        </Link>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {loading && (
                    <div className="py-4 flex justify-center text-slate-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-lg" />
                    </div>
                )}
            </div>
        </section>
    );
};

export default PriorityTaskList;
