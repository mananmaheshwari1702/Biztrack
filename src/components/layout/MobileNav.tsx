import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartLine,
    faCalendarAlt,
    faTasks,
    faUsers,
    faSitemap,
    faBars,
    faTimes,
    faSignOutAlt,
    faUserCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const MobileNav: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { logout } = useAuth();
    const { userProfile } = useData();

    const toggleOpen = () => setIsOpen(!isOpen);

    const navItems = [
        { to: '/', icon: faChartLine, label: 'Dashboard' },
        { to: '/calendar', icon: faCalendarAlt, label: 'Calendar' },
        { to: '/tasks', icon: faTasks, label: 'Tasks' },
        { to: '/clients', icon: faUsers, label: 'Follow Ups' },
        { to: '/team', icon: faSitemap, label: 'My Team' },
    ];

    return (
        <>
            {/* Top Bar */}
            <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white shadow-md fixed top-0 left-0 w-full z-[60]">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    BizTrack
                </h1>
                <button onClick={toggleOpen} className="text-slate-300 focus:outline-none p-2 -mr-2">
                    <FontAwesomeIcon icon={isOpen ? faTimes : faBars} className="text-2xl" />
                </button>
            </div>

            {/* Overlay Drawer */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={toggleOpen}>
                    <div
                        className="absolute right-0 top-0 h-full w-64 bg-slate-900 shadow-xl p-4 flex flex-col pt-20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <nav className="flex-1 space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setIsOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <FontAwesomeIcon icon={item.icon} className="w-5" />
                                    <span className="font-medium">{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                        <div className="mt-auto border-t border-slate-700 pt-4">
                            <NavLink to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 mb-4 p-2">
                                <FontAwesomeIcon icon={faUserCircle} className="text-2xl text-slate-300" />
                                <div>
                                    <p className="font-semibold text-white text-sm">{userProfile.name}</p>
                                    <p className="text-xs text-slate-400">{userProfile.level}</p>
                                </div>
                            </NavLink>
                            <button
                                onClick={() => {
                                    logout();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-600 text-slate-300"
                            >
                                <FontAwesomeIcon icon={faSignOutAlt} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileNav;
