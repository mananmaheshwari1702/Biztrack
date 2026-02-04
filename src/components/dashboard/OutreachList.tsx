import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import type { Client } from '../../types';
import { formatDisplayDate, getTodayInput, toInputDate } from '../../utils/dateUtils';
import { getWhatsAppLink } from '../../utils/phoneUtils';

/** Follow-up status for display and sorting: overdue (date < today) vs due today */
type FollowUpStatus = 'overdue' | 'due_today';

function getFollowUpStatus(nextFollowUpDate: string, todayStr: string): FollowUpStatus {
    const dateStr = toInputDate(nextFollowUpDate || '');
    if (!dateStr) return 'overdue'; // treat missing as overdue so they surface first
    return dateStr < todayStr ? 'overdue' : 'due_today';
}

function sortClientsByPriority(clients: Client[]): Client[] {
    const todayStr = getTodayInput();
    const overdue: Client[] = [];
    const dueToday: Client[] = [];
    for (const c of clients) {
        if (getFollowUpStatus(c.nextFollowUpDate, todayStr) === 'overdue') overdue.push(c);
        else dueToday.push(c);
    }
    const byDate = (a: Client, b: Client) =>
        new Date(a.nextFollowUpDate || 0).getTime() - new Date(b.nextFollowUpDate || 0).getTime();
    overdue.sort(byDate);
    dueToday.sort(byDate);
    return [...overdue, ...dueToday];
}

const SCROLL_LOAD_THRESHOLD_PX = 200;
const LOAD_TRIGGER_DEBOUNCE_MS = 150;

interface OutreachListProps {
    clients: Client[];
    onMarkDone: (client: Client) => void;
    onLoadMore: () => void;
    loading: boolean;
    totalCount: number;
}

const OutreachList: React.FC<OutreachListProps> = ({
    clients,
    onMarkDone,
    onLoadMore,
    loading,
    totalCount,
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadMoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hasMore = clients.length > 0 && clients.length < totalCount;
    const shouldTriggerLoad = hasMore && !loading;

    const tryLoadMore = useCallback(() => {
        if (!shouldTriggerLoad) return;
        if (loadMoreDebounceRef.current) clearTimeout(loadMoreDebounceRef.current);
        loadMoreDebounceRef.current = window.setTimeout(() => {
            loadMoreDebounceRef.current = null;
            onLoadMore();
        }, LOAD_TRIGGER_DEBOUNCE_MS);
    }, [shouldTriggerLoad, onLoadMore]);

    useEffect(() => {
        const scrollEl = scrollContainerRef.current;
        const sentinelEl = sentinelRef.current;
        if (!scrollEl || !sentinelEl || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (!entry?.isIntersecting) return;
                if (loading) return;
                if (clients.length >= totalCount) return;
                tryLoadMore();
            },
            {
                root: scrollEl,
                rootMargin: `${SCROLL_LOAD_THRESHOLD_PX}px 0px`,
                threshold: 0,
            }
        );

        observer.observe(sentinelEl);
        return () => {
            observer.disconnect();
            if (loadMoreDebounceRef.current) {
                clearTimeout(loadMoreDebounceRef.current);
                loadMoreDebounceRef.current = null;
            }
        };
    }, [hasMore, loading, clients.length, totalCount, tryLoadMore]);

    const todayStr = useMemo(() => getTodayInput(), []);
    const sortedClients = useMemo(() => sortClientsByPriority(clients), [clients]);

    const allCaughtUp = totalCount === 0;

    return (
        <section
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-0"
            aria-labelledby="outreach-heading"
        >
            <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <h2
                    id="outreach-heading"
                    className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2"
                >
                    <span
                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"
                        aria-hidden
                    >
                        <FontAwesomeIcon icon={faPhone} className="text-sm" />
                    </span>
                    Today&apos;s outreach
                </h2>
                <span
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                        allCaughtUp
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                    }`}
                >
                    {allCaughtUp ? 'All caught up' : `${totalCount} pending`}
                </span>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto min-h-0 max-h-[min(60vh,520px)] overflow-x-hidden"
                aria-busy={loading}
                aria-label="Outreach list"
            >
                {clients.length === 0 && !loading ? (
                    <div className="px-6 py-12 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-2xl" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">No calls due</p>
                        <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up.</p>
                    </div>
                ) : (
                    <>
                        <ul className="divide-y divide-slate-100 pl-6" role="list">
                            {sortedClients.map((client) => {
                                const status = getFollowUpStatus(client.nextFollowUpDate, todayStr);
                                const isOverdue = status === 'overdue';
                                const isDueToday = status === 'due_today';
                                return (
                                    <li
                                        key={client.id}
                                        className="relative py-4 pr-6 overflow-hidden hover:bg-slate-50/70 transition-colors -ml-6 pl-6"
                                    >
                                        {/* Left indicator bar: red = overdue, yellow = due today (4px, full height) */}
                                        <div
                                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l flex-shrink-0 ${
                                                isOverdue
                                                    ? 'bg-red-500'
                                                    : isDueToday
                                                    ? 'bg-amber-400'
                                                    : 'bg-slate-200'
                                            }`}
                                            aria-hidden
                                            role="presentation"
                                        />
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pl-4">
                                            <div className="flex items-start gap-4 min-w-0">
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm overflow-hidden border border-slate-200/80 flex-shrink-0">
                                                    {client.profileImage ? (
                                                        <img
                                                            src={client.profileImage}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        client.clientName.charAt(0)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-slate-900 truncate">
                                                            {client.clientName}
                                                        </p>
                                                        {isOverdue && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-100 px-2 py-0.5 rounded shrink-0">
                                                                Overdue
                                                            </span>
                                                        )}
                                                        {isDueToday && (
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                                                                Due today
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                        {getWhatsAppLink(client.mobile) ? (
                                                            <a
                                                                href={getWhatsAppLink(client.mobile)!}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors truncate"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <FontAwesomeIcon icon={faWhatsapp} />
                                                                <span className="truncate">{client.mobile}</span>
                                                            </a>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 truncate">
                                                                <FontAwesomeIcon icon={faPhone} />
                                                                {client.mobile}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {client.notes && (
                                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic truncate">
                                                            &ldquo;{client.notes}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
                                                <span className="text-xs font-medium text-slate-500">
                                                    {formatDisplayDate(client.nextFollowUpDate)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onMarkDone(client)}
                                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98] transition-all"
                                                >
                                                    <FontAwesomeIcon icon={faCheckCircle} />
                                                    Mark done
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Inline loading indicator: subtle spinner when fetching more */}
                        {loading && (
                            <div
                                className="flex items-center justify-center gap-2 py-5 text-slate-400"
                                role="status"
                                aria-live="polite"
                                aria-label="Loading more"
                            >
                                <FontAwesomeIcon icon={faSpinner} spin className="text-sm" />
                                <span className="text-sm font-medium">Loading…</span>
                            </div>
                        )}

                        {/* Sentinel for infinite scroll: triggers load when near bottom */}
                        {hasMore && (
                            <div
                                ref={sentinelRef}
                                className="h-2 w-full flex-shrink-0"
                                aria-hidden
                            />
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

export default OutreachList;
