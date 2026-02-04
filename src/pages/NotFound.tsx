import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
            <h1 className="text-6xl font-bold text-blue-600 mb-4">404</h1>
            <p className="text-xl mb-8">Page not found</p>
            <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Go Home
            </Link>
        </div>
    );
};

export default NotFound;
