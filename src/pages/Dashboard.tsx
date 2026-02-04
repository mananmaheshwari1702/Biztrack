import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useClients } from '../hooks/useClients';
import StatsCard from '../components/dashboard/StatsCard';
import OutreachList from '../components/dashboard/OutreachList';
import PriorityTaskList from '../components/dashboard/PriorityTaskList';
import QuickActions from '../components/dashboard/QuickActions';
import TaskStatsCard from '../components/dashboard/TaskStatsCard';
import UpcomingFollowUps from '../components/dashboard/UpcomingFollowUps';
import RecentActivity from '../components/dashboard/RecentActivity';
import DashboardSearch from '../components/dashboard/DashboardSearch';
import CallOutcomeModal, { type OutcomeResult } from '../components/clients/CallOutcomeModal';
import { faUsers, faPhone } from '@fortawesome/free-solid-svg-icons';
import type { Client } from '../types';
import { fromInputDate } from '../utils/dateUtils';
import LoadingScreen from '../components/common/LoadingScreen';

const Dashboard: React.FC = () => {
    const {
        recentClients,
        dueClients,
        priorityTasks,
        recentContacts,
        upcomingFollowUps,
        counts,
        loading,
        refresh,
        loadMoreDue,
        loadMoreTasks,
        loadingMoreDue,
        loadingMoreTasks
    } = useDashboardData();

    const { updateClient } = useClients();
    const [selectedClientForOutcome, setSelectedClientForOutcome] = useState<Client | null>(null);

    if (loading) {
        return <LoadingScreen />;
    }

    const handleCallOutcome = async (result: OutcomeResult) => {
        if (!selectedClientForOutcome) return;

        const updatedClient: Client = {
            ...selectedClientForOutcome,
            lastContactDate: new Date().toISOString(),
        };

        if (result.outcome === 'WrongNumber') {
            updatedClient.status = 'Archived';
            updatedClient.nextFollowUpDate = '';
            updatedClient.notes = result.notes
                ? `${selectedClientForOutcome.notes}\n[Wrong Number]: ${result.notes}`
                : selectedClientForOutcome.notes;
        } else {
            if (result.date) {
                updatedClient.nextFollowUpDate = fromInputDate(result.date);
            }
            if (result.frequency) {
                updatedClient.frequency = result.frequency;
            }
            if (result.clientType) {
                updatedClient.clientType = result.clientType;
            }
            if (result.notes) {
                updatedClient.notes = selectedClientForOutcome.notes
                    ? `${selectedClientForOutcome.notes}\n[${result.outcome}]: ${result.notes}`
                    : result.notes;
            }
        }

        try {
            await updateClient(updatedClient);
            refresh();
            setSelectedClientForOutcome(null);
        } catch (error) {
            console.error("Failed to update client outcome", error);
        }
    };

    const callsDue = counts.dueCalls;
    const allCaughtUp = callsDue === 0;

    return (
        <div className="space-y-8 md:space-y-10 max-w-[1600px] mx-auto pb-12 md:pb-16 min-w-0 px-0 overflow-x-hidden">
            {/* Primary hero: Calls due today — instant hierarchy */}
            <section
                className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm transition-shadow hover:shadow-[var(--dashboard-card-shadow-hover)]"
                aria-label="Calls due today"
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${allCaughtUp ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            <span className="text-2xl md:text-3xl font-bold tabular-nums">{callsDue}</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                                Calls due today
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {allCaughtUp
                                    ? 'All caught up — no calls pending.'
                                    : 'Work through the list below to stay on track.'}
                            </p>
                        </div>
                    </div>
                    {!allCaughtUp && (
                        <a
                            href="#outreach-list"
                            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        >
                            <span>Go to list</span>
                            <span aria-hidden>↓</span>
                        </a>
                    )}
                </div>
            </section>

            {/* Header: title + search */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                        Dashboard
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Your day at a glance
                    </p>
                </div>
                <div className="w-full md:w-auto md:min-w-[280px]">
                    <DashboardSearch />
                </div>
            </header>

            {/* Stats row: secondary metrics */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6" aria-label="Key metrics">
                <StatsCard
                    title="Calls due"
                    value={counts.dueCalls}
                    icon={faPhone}
                    color={allCaughtUp ? 'green' : 'orange'}
                    trend={allCaughtUp ? 'All caught up' : 'Needs attention'}
                />
                <TaskStatsCard
                    overdue={counts.overdueTasks}
                    pending={counts.pendingTasks}
                    completed={counts.completedTasks || 0}
                />
                <StatsCard
                    title="Active clients"
                    value={counts.totalClients}
                    icon={faUsers}
                    color="blue"
                    trend="Total in database"
                />
            </section>

            {/* Quick actions: compact, obvious */}
            <QuickActions />

            {/* Main content grid */}
            <div
                id="outreach-list"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start scroll-mt-4"
            >
                <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    <OutreachList
                        clients={dueClients}
                        onMarkDone={setSelectedClientForOutcome}
                        onLoadMore={loadMoreDue}
                        loading={loadingMoreDue}
                        totalCount={counts.dueCalls}
                    />
                    <PriorityTaskList
                        tasks={priorityTasks}
                        onLoadMore={loadMoreTasks}
                        loading={loadingMoreTasks}
                    />
                </div>
                <div className="space-y-6 md:space-y-8 flex flex-col">
                    <UpcomingFollowUps clients={upcomingFollowUps} />
                    <RecentActivity newClients={recentClients} recentContacts={recentContacts} />
                </div>
            </div>

            <CallOutcomeModal
                isOpen={!!selectedClientForOutcome}
                onClose={() => setSelectedClientForOutcome(null)}
                onConfirm={handleCallOutcome}
                clientName={selectedClientForOutcome?.clientName || ''}
                currentClientType={selectedClientForOutcome?.clientType}
                initialFrequency={selectedClientForOutcome?.frequency}
            />
        </div>
    );
};

export default Dashboard;
