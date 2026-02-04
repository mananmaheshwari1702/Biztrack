import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPhone,
    faEnvelope,
    faCalendar,
    faEdit,
    faTrash,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import type { Client } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';
import { getWhatsAppLink } from '../../utils/phoneUtils';

interface ClientCardProps {
    client: Client;
    onEdit: (client: Client) => void;
    onDelete: (id: string) => void;
    onMarkDone: (client: Client) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onEdit, onDelete, onMarkDone }) => {
    const isOverdue = new Date(client.nextFollowUpDate) < new Date();
    const whatsappLink = getWhatsAppLink(client.mobile);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300 flex flex-col h-full group">
            <div className="p-6 flex-1 flex flex-col gap-3">
                {/* Name + Type */}
                <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-base overflow-hidden border border-slate-200 flex-shrink-0">
                            {client.profileImage ? (
                                <img src={client.profileImage} alt={client.clientName} className="w-full h-full object-cover" />
                            ) : (
                                client.clientName.charAt(0)
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 line-clamp-1" title={client.clientName}>
                                {client.clientName}
                            </h4>
                            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold inline-block mt-1 ${client.clientType === 'Prospect' ? 'bg-purple-100 text-purple-600' :
                                client.clientType === 'User' ? 'bg-green-100 text-green-600' :
                                    client.clientType === 'Supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'
                                }`}>
                                {client.clientType}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Contact */}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    {whatsappLink ? (
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-green-600 transition-colors w-full min-w-0"
                        >
                            <FontAwesomeIcon icon={faWhatsapp} className="w-4 text-green-500 flex-shrink-0" />
                            <span className="truncate">{client.mobile}</span>
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 w-full min-w-0">
                            <FontAwesomeIcon icon={faPhone} className="w-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{client.mobile}</span>
                        </div>
                    )}
                </div>

                {client.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <FontAwesomeIcon icon={faEnvelope} className="w-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                    </div>
                )}

                {/* Next Call Date */}
                <div className="mt-1">
                    <div className="text-xs text-slate-500 uppercase font-medium tracking-wider mb-0.5 flex items-center gap-1">
                        <FontAwesomeIcon icon={faCalendar} className="text-slate-400" /> Next Call
                    </div>
                    <div className={`font-semibold text-slate-800 ${isOverdue ? 'text-red-600' : ''}`}>
                        {formatDisplayDate(client.nextFollowUpDate)}
                    </div>
                    {client.frequency && (
                        <div className="text-xs text-slate-400 mt-0.5">
                            {client.frequency}
                        </div>
                    )}
                </div>

                {/* Notes Preview */}
                {client.notes && (
                    <p className="text-xs text-slate-500 line-clamp-2 italic">
                        "{client.notes}"
                    </p>
                )}
            </div>

            {/* Actions: Mark Done primary, Edit/Delete secondary */}
            <div className="p-6 pt-0 flex gap-3 border-t border-slate-100">
                <button
                    onClick={() => onMarkDone(client)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                    title="Mark call done / Log outcome"
                >
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Mark Done</span>
                </button>
                <button
                    onClick={() => onEdit(client)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-500 rounded-lg transition"
                    title="Edit Client"
                >
                    <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                    onClick={() => onDelete(client.id)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-500 rounded-lg transition"
                    title="Delete Client"
                >
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </div>
        </div>
    );
};

export default ClientCard;
