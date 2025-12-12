import React, { useState, useRef } from 'react';
import { Calendar, Type, Upload, FileText, ArrowRight, X, ScanEye, CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react';
import { MeetingContext } from '../types';
import { analyzeDocumentStyle } from '../services/geminiService';

interface SetupMeetingProps {
  onNext: (data: MeetingContext) => void;
  onCancel: () => void;
}

const SetupMeeting: React.FC<SetupMeetingProps> = ({ onNext, onCancel }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setAnalysisResult(null); 
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await analyzeDocumentStyle(file);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || "Gagal menganalisis format file.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ 
        title, 
        date,
        participants,
        referenceFile: file,
        styleGuide: analysisResult || undefined 
    });
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-white overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
      
      {/* Header Form */}
      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Setup Rapat</h2>
          <p className="text-xs text-gray-500 mt-0.5">Isi detail untuk memulai notulensi</p>
        </div>
        <button onClick={onCancel} className="bg-white p-2 rounded-full text-gray-400 hover:text-gray-800 shadow-sm border border-gray-100 active:scale-95 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* Input Groups */}
        <div className="space-y-5">
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informasi Dasar</label>
                <div className="grid gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Type className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-transparent focus:bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-medium placeholder:font-normal"
                            placeholder="Judul Rapat (Misal: Rapat Pleno)"
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Calendar className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-transparent focus:bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-medium"
                        />
                    </div>
                </div>
            </div>

            <div>
               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Peserta</label>
               <div className="relative group">
                  <div className="absolute top-3.5 left-4 pointer-events-none">
                      <Users className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <textarea
                    required
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    rows={3}
                    className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-transparent focus:bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none leading-relaxed"
                    placeholder="Sebutkan nama peserta: Budi, Ani, Candra..."
                  />
               </div>
            </div>

            {/* Custom Format Section */}
            <div className="pt-2">
               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                   Format Laporan <span className="text-gray-400 font-normal normal-case tracking-normal ml-1">(Opsional)</span>
               </label>
               
               {!file ? (
                 <div 
                     onClick={() => fileInputRef.current?.click()}
                     className="group border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300"
                 >
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*,.txt" />
                     <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 mb-2 group-hover:scale-110 transition-transform">
                         <Upload className="w-5 h-5" />
                     </div>
                     <p className="text-sm font-medium text-gray-600 group-hover:text-indigo-700">Upload Contoh Dokumen</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                     <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                         <div className="flex items-center gap-3 overflow-hidden">
                             <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                                 <FileText className="w-5 h-5 text-indigo-600" />
                             </div>
                             <div className="min-w-0">
                                 <p className="font-medium text-gray-900 text-sm truncate">{file.name}</p>
                                 <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                             </div>
                         </div>
                         <button type="button" onClick={() => { setFile(null); setAnalysisResult(null); setError(null); }} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors">
                             <X className="w-4 h-4" />
                         </button>
                     </div>

                     {!analysisResult && !isAnalyzing && (
                         <button type="button" onClick={handleAnalyze} className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-black transition-colors">
                             <ScanEye className="w-4 h-4" />
                             Analisis Format
                         </button>
                     )}

                     {isAnalyzing && (
                         <div className="bg-blue-50 text-blue-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm animate-pulse">
                             <Loader2 className="w-4 h-4 animate-spin" />
                             Menganalisis...
                         </div>
                     )}

                     {error && (
                         <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm">
                             <AlertCircle className="w-4 h-4 shrink-0" />
                             {error}
                         </div>
                     )}

                     {analysisResult && (
                         <div className="bg-green-50/80 border border-green-100 rounded-xl p-3 animate-in slide-in-from-top-1">
                             <div className="flex items-center gap-1.5 mb-1 text-green-700 font-semibold text-sm">
                                 <CheckCircle2 className="w-4 h-4" />
                                 Format Tersimpan
                             </div>
                             <p className="text-xs text-green-600 line-clamp-2">{analysisResult}</p>
                         </div>
                     )}
                 </div>
               )}
            </div>
        </div>

        <button
            type="submit"
            disabled={!!file && !analysisResult}
            className={`w-full flex items-center justify-center gap-2 font-semibold text-base py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] ${
                !!file && !analysisResult 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
        >
            {!!file && !analysisResult ? 'Selesaikan Analisis' : 'Mulai Rapat'}
            <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default SetupMeeting;