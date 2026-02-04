import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartLine,
    faCalendarAlt,
    faTasks,
    faUsers,
    faSitemap,
    faSignOutAlt,
    faUserCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { logger } from '../../utils/logger';

const Sidebar: React.FC = () => {
    const { logout } = useAuth();
    const { userProfile } = useData();
    const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            logger.error("Logout failed", error);
        }
    };

    const navItems = [
        { to: '/', icon: faChartLine, label: 'Dashboard' },
        { to: '/calendar', icon: faCalendarAlt, label: 'Calendar' },
        { to: '/tasks', icon: faTasks, label: 'Tasks' },
        { to: '/clients', icon: faUsers, label: 'Follow Ups' },
        { to: '/team', icon: faSitemap, label: 'My Organization' },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 h-screen bg-slate-900 text-white fixed left-0 top-0 z-50 shadow-xl">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    BizTrack
                </h1>
                <p className="text-xs text-slate-400 mt-1">Manage your empire</p>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <FontAwesomeIcon icon={item.icon} className="w-5" />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <NavLink to="/profile" className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-300 overflow-hidden ${!userProfile.photoURL && !userProfile.avatarColor ? 'bg-slate-700' : ''}`}
                        style={!userProfile.photoURL && userProfile.avatarColor ? { backgroundColor: userProfile.avatarColor, color: 'white' } : {}}
                    >
                        {userProfile.photoURL ? (
                            <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            userProfile.name ? <span className="font-bold text-sm">{userProfile.name.charAt(0).toUpperCase()}</span> : <FontAwesomeIcon icon={faUserCircle} className="text-2xl" />
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-sm truncate">{userProfile.name}</p>
                        <p className="text-xs text-slate-400 truncate">{userProfile.level}</p>
                    </div>
                </NavLink>
                <button
                    onClick={() => setIsSignOutModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm"
                >
                    <FontAwesomeIcon icon={faSignOutAlt} />
                    <span>Sign Out</span>
                </button>
            </div>

            <ConfirmationModal
                isOpen={isSignOutModalOpen}
                onClose={() => setIsSignOutModalOpen(false)}
                onConfirm={handleLogout}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                confirmText="Sign Out"
                isDestructive={false}
            />
        </aside>
    );
};

export default Sidebar;
