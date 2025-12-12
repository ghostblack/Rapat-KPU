import React from 'react';
import { FileText, LogOut } from 'lucide-react';

interface HeaderProps {
  user?: {
    photoURL?: string | null;
    displayName?: string | null;
  } | null;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 border-b border-white/20 shadow-sm transition-all duration-300">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Logo Section */}
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-2 rounded-xl shadow-lg shadow-indigo-200">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-gray-900 leading-none tracking-tight">Notulensi AI</h1>
            <span className="text-[10px] font-medium text-indigo-600 tracking-wide uppercase mt-0.5">KPU Assistant</span>
          </div>
        </div>

        {/* User Section */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* Desktop/Tablet User Info */}
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-sm font-semibold text-gray-800">{user.displayName}</span>
                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">Admin</span>
              </div>
              
              {/* Avatar */}
              <div className="relative">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="User" 
                    className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-white border border-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>

              {/* Logout Button */}
              <button 
                onClick={onLogout}
                className="ml-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                title="Keluar"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;