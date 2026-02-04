import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClients, useDueClients } from '../hooks/useClients';
import { useToast } from '../context/ToastContext';
import type { Client, ClientType } from '../types';
import ClientCard from '../components/clients/ClientCard';
import ClientModal from '../components/clients/ClientModal';
import CallOutcomeModal, { type OutcomeResult } from '../components/clients/CallOutcomeModal';
import ImportPreviewModal from '../components/clients/ImportPreviewModal';
import ClientFilters from '../components/clients/ClientFilters';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSortAmountDown, faSortAmountUp, faFileImport, faFileExport, faCheckCircle, faEdit, faTrash, faCheck, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

import { parseExcel, exportClientsToExcel } from '../utils/excelUtils';
import { getWhatsAppLink } from '../utils/phoneUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import { logger } from '../utils/logger';

const Clients: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Filter & Sort State (Must be defined before useClients)
    const [filterType, setFilterType] = useState<ClientType | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'clientName' | 'nextFollowUpDate'>('nextFollowUpDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Cards Pagination (kept separate, MUST be before useDueClients)
    const [currentCardsPage, setCurrentCardsPage] = useState(1);
    const CARDS_PER_PAGE = 24;

    // Using hook-based data access with page-based pagination
    const {
        clients,
        // clients is now the data for the current page
        loading: clientsLoading,
        totalFetched, // This is now the real total count from server
        addClient,
        updateClient,
        deleteClient,
        bulkDeleteClients,
        bulkUpdateClients,
    } = useClients(filterType, searchQuery, sortField, currentPage, ITEMS_PER_PAGE);

    // Separate hook for due clients (optimized query), now with server-side pagination
    const {
        data: dueClientsPageData,
        // loading: dueLoading, // Unused for now
        totalFetched: totalDueCount
    } = useDueClients(currentCardsPage, CARDS_PER_PAGE);

    const { success, error } = useToast();
    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
    // filterType, searchQuery, sortField were here previously
    const [followUpSearchQuery, setFollowUpSearchQuery] = useState(''); // New state for Follow-Ups search

    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
    const [activeClientForOutcome, setActiveClientForOutcome] = useState<Client | null>(null);

    // Import Modal State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importData, setImportData] = useState<Record<string, unknown>[]>([]);

    // Bulk Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // REMOVED DUPLICATE Cards Pagination Logic (Moved to top)
    // Filter & Sort Logic
    // Dashboard Logic: Due Today & Overdue - Now uses optimized server query via useDueClients hook
    // Filtered Due Clients (Follow-Ups Search) works on the currently fetched page
    const paginatedDueClients = useMemo(() => {
        if (!followUpSearchQuery.trim()) return dueClientsPageData;
        const query = followUpSearchQuery.toLowerCase();
        return dueClientsPageData.filter(c =>
            c.clientName.toLowerCase().includes(query) ||
            c.mobile.includes(query)
        );
    }, [dueClientsPageData, followUpSearchQuery]);

    // Cards Pagination Logic (Total pages based on server total)
    const totalCardPages = Math.ceil(totalDueCount / CARDS_PER_PAGE);

    // Cards Pagination Safety Check (Auto-navigate if empty)
    React.useEffect(() => {
        if (currentCardsPage > totalCardPages && totalCardPages > 0) {
            setCurrentCardsPage(totalCardPages);
        } else if (totalCardPages === 0 && currentCardsPage !== 1) {
            setCurrentCardsPage(1);
        }
    }, [totalDueCount, totalCardPages, currentCardsPage]);

    // Resets: Reset page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterType, searchQuery]);

    // Clear selection on page change
    React.useEffect(() => {
        setSelectedClientIds(new Set());
    }, [currentPage]);

    // ... Handlers ...
    // (We skip handlers for brevity of replacement if possible, but replace_file_content needs contiguous block)
    // I need to be careful not to delete handlers if I replace a large chunk.
    // The previous view showed handlers starting around line 143.
    // I will use START and END lines carefully.

    // Wait, the ReplacementContent must include everything between StartLine and EndLine.
    // My StartLine is 26.
    // My EndLine should coverage until... line 140 (before Handlers).
    // And I also need to update the JSX later.

    // Let's do this in chunks.
    // Chunk 1: Update useClients call and remove allClients (lines 26-140 approx).



    // Handlers
    const handleAddClient = async (client: Client) => {
        try {
            if (editingClient) {
                await updateClient(client);
                success('Client Updated', `${client.clientName} has been updated successfully.`);
            } else {
                await addClient(client);
                success('Client Added', `${client.clientName} has been added successfully.`);
            }
            setEditingClient(null);
        } catch (err) {
            logger.error('Client operation failed:', err);
            error('Operation Failed', editingClient ? 'Failed to update client. Please try again.' : 'Failed to add client. Please try again.');
        }
    };

    const openEditModal = (client: Client) => {
        setEditingClient(client);
        setIsClientModalOpen(true);
    };

    const openOutcomeModal = (client: Client) => {
        setActiveClientForOutcome(client);
        setIsOutcomeModalOpen(true);
    };

    const handleCallOutcome = async (result: OutcomeResult) => {
        if (!activeClientForOutcome) return;

        const { outcome, date, notes, clientType } = result;

        const updatedClient = { ...activeClientForOutcome };
        const now = new Date();
        updatedClient.lastContactDate = now.toISOString();

        if (notes) updatedClient.notes = notes;

        if (outcome === 'WrongNumber') {
            updatedClient.status = 'Archived';
        } else {
            if (date) updatedClient.nextFollowUpDate = new Date(date).toISOString();

            if (result.frequency) updatedClient.frequency = result.frequency;

            if (outcome === 'Sale' && clientType) {
                updatedClient.clientType = clientType;
            }
        }

        try {
            await updateClient(updatedClient);
            success('Follow-Up Logged', `Call outcome recorded for ${updatedClient.clientName}.`);
        } catch (err) {
            logger.error('Failed to log call outcome:', err);
            error('Failed to Save', 'Could not save call outcome. Please try again.');
        }
        setIsOutcomeModalOpen(false);
        setActiveClientForOutcome(null);
    };

    const toggleSort = (field: 'clientName' | 'nextFollowUpDate') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleDeleteClient = (id: string) => {
        setClientToDelete(id);
        setIsDeleteModalOpen(true);
    };

    // Bulk Selection Logic
    const toggleSelectAll = () => {
        if (selectedClientIds.size === clients.length && clients.length > 0) {
            setSelectedClientIds(new Set());
        } else {
            // Select only visible clients on current page
            setSelectedClientIds(new Set(clients.map(c => c.id)));
        }
    };

    const toggleSelectClient = (id: string) => {
        const newSelected = new Set(selectedClientIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedClientIds(newSelected);
    };


    const handleBulkDelete = () => {
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            if (clientToDelete) {
                await deleteClient(clientToDelete);
                success('Client Deleted', 'Client has been removed successfully.');
            } else {
                const count = selectedClientIds.size;
                await bulkDeleteClients(Array.from(selectedClientIds));
                setSelectedClientIds(new Set());
                success('Bulk Delete Complete', `${count} client(s) have been removed.`);
            }
            setIsDeleteModalOpen(false);
            setClientToDelete(null);
        } catch (err) {
            logger.error("Delete failed", err);
            error('Delete Failed', 'Failed to delete client(s). Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkStatusUpdate = async (status: 'Active' | 'Archived') => {
        try {
            const count = selectedClientIds.size;
            await bulkUpdateClients(Array.from(selectedClientIds), { status });
            success('Status Updated', `${count} client(s) have been ${status === 'Archived' ? 'archived' : 'set to active'}.`);
            setSelectedClientIds(new Set());
        } catch (err) {
            logger.error('Bulk status update failed:', err);
            error('Update Failed', 'Failed to update client status. Please try again.');
        }
    };

    // Excel Handlers
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleExport = () => {
        exportClientsToExcel(clients);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const rawData = await parseExcel(file);
            setImportData(rawData);
            setIsImportModalOpen(true);
        } catch (err) {
            logger.error('Import parsing failed', err);
            error('Import Failed', 'Failed to parse file. Please check the format and try again.');
        }
        // Reset input
        e.target.value = '';
    };

    const [searchParams] = useSearchParams(); // Needs import
    const databaseRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null); // For auto-focus
    const [highlightedClientId, setHighlightedClientId] = useState<string | null>(null);

    // Auto-Search & Scroll Logic
    React.useEffect(() => {
        const searchParam = searchParams.get('search');
        const timeoutIds: ReturnType<typeof setTimeout>[] = [];

        if (searchParam) {
            setSearchQuery(searchParam);
            setFilterType('All'); // Reset filter to ensure visibility

            // Scroll to database section
            timeoutIds.push(setTimeout(() => {
                databaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                searchInputRef.current?.focus(); // Auto-focus search input
            }, 100));

            // Find match for highlighting
            const match = clients.find(c => c.clientName.toLowerCase() === searchParam.toLowerCase());
            if (match) {
                setHighlightedClientId(match.id);
                // Remove highlight after 2 seconds
                timeoutIds.push(setTimeout(() => setHighlightedClientId(null), 2000));
            }
        }

        // Cleanup timeouts on unmount
        return () => {
            timeoutIds.forEach(id => clearTimeout(id));
        };
    }, [searchParams, clients]); // Depend on clients to find match

    const handleImportComplete = () => {
        setIsImportModalOpen(false);
        setImportData([]);
        // Force refresh? Handled by snapshot listeners usually.
    };

    return (
        <div className="max-w-[1600px] mx-auto w-full">

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Follow Ups</h2>
                    <p className="text-slate-500 text-sm md:text-base mt-1">Manage client relationships and sales pipeline.</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />
                    <button
                        onClick={handleImportClick}
                        className="flex-1 lg:flex-none justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition"
                    >
                        <FontAwesomeIcon icon={faFileImport} />
                        Import Clients
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 lg:flex-none justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition"
                    >
                        <FontAwesomeIcon icon={faFileExport} />
                        Export
                    </button>
                    <button
                        onClick={() => { setEditingClient(null); setIsClientModalOpen(true); }}
                        className="flex-1 lg:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition whitespace-nowrap min-h-[44px]"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        Add Client
                    </button>
                </div>
            </div>

            {/* SECTION 1: Calls Due Today & Overdue */}
            <div className="mb-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-800">Calls Due Today & Overdue</h3>
                        <span className="bg-red-100 text-red-600 text-sm font-bold px-3 py-1 rounded-full">
                            {totalDueCount}
                        </span>
                    </div>
                    {/* Follow-Ups Search Bar */}
                    <div className="w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Search follow-ups..."
                            value={followUpSearchQuery}
                            onChange={(e) => setFollowUpSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                    {paginatedDueClients.length > 0 ? (
                        paginatedDueClients.map(client => (
                            <ClientCard
                                key={client.id}
                                client={client}
                                onEdit={openEditModal}
                                onDelete={handleDeleteClient}
                                onMarkDone={openOutcomeModal}
                            />
                        ))
                    ) : (
                        <div className="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            {totalDueCount > 0 ? (
                                <>
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-3xl text-slate-300 mb-2" />
                                    <p className="font-medium">No clients found matching "{followUpSearchQuery}"</p>
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-3xl text-emerald-200 mb-2" />
                                    <p className="font-medium">All caught up! No calls due today.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Cards Pagination Footer */}
                {totalDueCount > CARDS_PER_PAGE && (
                    <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-xl">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-700">{(currentCardsPage - 1) * CARDS_PER_PAGE + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentCardsPage * CARDS_PER_PAGE, totalDueCount)}</span> of <span className="font-bold text-slate-700">{totalDueCount}</span> overdue/due
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentCardsPage(prev => Math.max(1, prev - 1))}
                                disabled={currentCardsPage === 1}
                                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" /> Previous
                            </button>
                            <span className="text-sm text-slate-600 font-medium px-2 min-w-[80px] text-center">
                                Page {currentCardsPage} of {totalCardPages}
                            </span>
                            <button
                                onClick={() => setCurrentCardsPage(prev => Math.min(totalCardPages, prev + 1))}
                                disabled={currentCardsPage === totalCardPages}
                                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                            >
                                Next <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 2: All Clients Database */}
                <div ref={databaseRef} className="scroll-mt-24">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800">All Clients Database ({totalFetched})</h3>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center">
                        {selectedClientIds.size > 0 ? (
                            <div className="flex items-center gap-4 w-full animate-fade-in text-slate-700">
                                <span className="font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm">
                                    {selectedClientIds.size} Selected
                                </span>
                                <div className="h-6 w-px bg-slate-300 mx-2"></div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleBulkStatusUpdate('Active')}
                                        className="bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={faCheck} /> Set Active
                                    </button>
                                    <button
                                        onClick={() => handleBulkStatusUpdate('Archived')}
                                        className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                                    >
                                        Archive
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isDeleting}
                                        className={`bg-white border border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} /> Delete
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <ClientFilters
                                filterType={filterType}
                                setFilterType={setFilterType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                searchInputRef={searchInputRef}
                            />
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                    <th className="p-4 w-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={clients.length > 0 && selectedClientIds.size === clients.length}
                                            onChange={toggleSelectAll}
                                            disabled={isDeleting}
                                        />
                                    </th>
                                    <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('clientName')}>
                                        Client <FontAwesomeIcon icon={sortField === 'clientName' && sortDirection === 'desc' ? faSortAmountUp : faSortAmountDown} className={`ml-1 ${sortField === 'clientName' ? 'opacity-100' : 'opacity-50'}`} />
                                    </th>
                                    <th className="p-4 hidden md:table-cell">Contact</th>
                                    <th className="p-4 hidden sm:table-cell">Type</th>
                                    <th className="p-4 hidden lg:table-cell">Status</th>
                                    <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('nextFollowUpDate')}>
                                        Next Call <FontAwesomeIcon icon={sortField === 'nextFollowUpDate' && sortDirection === 'desc' ? faSortAmountUp : faSortAmountDown} className={`ml-1 ${sortField === 'nextFollowUpDate' ? 'opacity-100' : 'opacity-50'}`} />
                                    </th>
                                    <th className="p-4 hidden xl:table-cell">Notes</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {clients.map(client => (
                                    <tr key={client.id} className={`hover:bg-slate-50 transition-colors duration-500 ${selectedClientIds.has(client.id) ? 'bg-blue-50/30' : ''} ${highlightedClientId === client.id ? 'bg-blue-100 ring-2 ring-blue-500/20' : ''}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedClientIds.has(client.id)}
                                                onChange={() => toggleSelectClient(client.id)}
                                                disabled={isDeleting}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden border border-slate-200 flex-shrink-0">
                                                    {client.profileImage ? (
                                                        <img src={client.profileImage} alt={client.clientName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        client.clientName.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-800">{client.clientName}</div>
                                                    <div className="md:hidden text-xs text-slate-500">
                                                        {getWhatsAppLink(client.mobile) ? (
                                                            <a
                                                                href={getWhatsAppLink(client.mobile)!}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:text-blue-600 hover:underline"
                                                            >
                                                                {client.mobile}
                                                            </a>
                                                        ) : (
                                                            client.mobile
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <div className="text-slate-600 font-medium">
                                                {getWhatsAppLink(client.mobile) ? (
                                                    <a
                                                        href={getWhatsAppLink(client.mobile)!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:text-blue-600 hover:underline"
                                                    >
                                                        {client.mobile}
                                                    </a>
                                                ) : (
                                                    client.mobile
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">{client.email}</div>
                                        </td>
                                        <td className="p-4 hidden sm:table-cell">
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${client.clientType === 'Prospect' ? 'bg-purple-100 text-purple-600' :
                                                client.clientType === 'User' ? 'bg-green-100 text-green-600' :
                                                    client.clientType === 'Supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {client.clientType}
                                            </span>
                                        </td>
                                        <td className="p-4 hidden lg:table-cell">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${client.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700">
                                                {formatDisplayDate(client.nextFollowUpDate)}
                                            </div>
                                            <div className="text-xs text-slate-400">{client.frequency}</div>
                                        </td>
                                        <td className="p-4 max-w-xs truncate text-slate-500 hidden xl:table-cell" title={client.notes}>
                                            {client.notes}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => openEditModal(client)} className="text-slate-400 hover:text-blue-600 p-2">
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {clients.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                            {clientsLoading ? 'Loading clients...' : 'No clients found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-700">{totalFetched > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, totalFetched)}</span> out of <span className="font-bold text-slate-700">{totalFetched}</span> clients
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" /> Previous
                            </button>
                            <span className="text-sm text-slate-600 font-medium px-2 min-w-[80px] text-center">
                                Page {currentPage} of {Math.max(1, Math.ceil(totalFetched / ITEMS_PER_PAGE))}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                disabled={currentPage >= Math.ceil(totalFetched / ITEMS_PER_PAGE)}
                                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                            >
                                Next <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ClientModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onSave={handleAddClient}
                initialClient={editingClient}
                existingClients={clients}
            />

            <CallOutcomeModal
                isOpen={isOutcomeModalOpen}
                onClose={() => setIsOutcomeModalOpen(false)}
                onConfirm={handleCallOutcome}
                clientName={activeClientForOutcome?.clientName || ''}
                currentClientType={activeClientForOutcome?.clientType}
                initialFrequency={activeClientForOutcome?.frequency}
            />

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setIsDeleteModalOpen(false);
                        setClientToDelete(null);
                    }
                }}
                onConfirm={confirmDelete}
                title={clientToDelete ? "Delete Client?" : "Delete Clients?"}
                message={clientToDelete
                    ? "Are you sure you want to delete this client? This action cannot be undone."
                    : `Are you sure you want to delete ${selectedClientIds.size} clients? This action cannot be undone.`
                }
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                isDestructive={true}
                isLoading={isDeleting}
            />

            <ImportPreviewModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                fileData={importData}
                existingClients={clients}
                onImportComplete={handleImportComplete}
            />
        </div>
    );
};

export default Clients;
