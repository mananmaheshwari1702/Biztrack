import React from 'react';
import type { ClientType } from '../../types';

interface ClientFiltersProps {
    filterType: ClientType | 'All';
    setFilterType: (type: ClientType | 'All') => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const ClientFilters: React.FC<ClientFiltersProps> = ({ filterType, setFilterType, searchQuery, setSearchQuery, searchInputRef }) => {
    const tabs = ['All', 'Prospect', 'User', 'Associate', 'Supervisor'];

    return (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilterType(tab as any)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterType === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="w-full md:w-64">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};

export default ClientFilters;
