import React, { useState } from 'react';
import { FileText, User, Lock, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { loginAsDefaultAdmin } from '../services/firebase';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (username.trim() !== 'admin' || password !== 'admin') {
        setError("Kombinasi akun tidak ditemukan.");
        setLoading(false);
        return;
    }

    try {
        await loginAsDefaultAdmin();
    } catch (err: any) {
       console.error(err);
       setError("Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white sm:bg-slate-50 p-4">
      
      <div className="w-full max-w-sm bg-white sm:rounded-3xl sm:shadow-2xl sm:shadow-indigo-100 sm:border border-white p-6 sm:p-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
        
        <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center mb-5 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Selamat Datang</h2>
            <p className="text-gray-500 text-sm mt-1">Sistem Notulensi Rapat KPU</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
             {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium p-3 rounded-xl flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="group">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            required 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 text-gray-900 text-sm rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 focus:bg-white transition-all outline-none"
                            placeholder="Username"
                        />
                    </div>
                </div>

                <div className="group">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 text-gray-900 text-sm rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 focus:bg-white transition-all outline-none"
                            placeholder="Password"
                        />
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full group relative flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gray-900 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all duration-300 shadow-lg hover:shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        Masuk Dashboard
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Notulensi AI v1.0
      </div>
    </div>
  );
};

export default Login;