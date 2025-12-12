import React from 'react';
import { Calendar, ChevronRight, Clock } from 'lucide-react';
import { MeetingHistoryItem } from '../types';

interface HistoryListProps {
  history: MeetingHistoryItem[];
  onSelect: (item: MeetingHistoryItem) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect }) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/50 rounded-3xl border border-dashed border-gray-200 text-center">
        <div className="bg-gray-50 p-4 rounded-full mb-3">
            <Clock className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium text-sm">Belum ada riwayat rapat.</p>
        <p className="text-gray-400 text-xs mt-1">Mulai rapat baru untuk melihat riwayat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Riwayat Terbaru</h3>
        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{history.length} Rapat</span>
      </div>
      
      <div className="grid gap-3">
        {history.map((item) => (
          <div 
            key={item.id}
            onClick={() => onSelect(item)}
            className="group relative bg-white p-5 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 hover:border-indigo-100 transition-all duration-300 cursor-pointer overflow-hidden active:scale-[0.99]"
          >
            <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-1 pr-4 overflow-hidden">
                    <h4 className="font-semibold text-gray-900 truncate text-[15px] group-hover:text-indigo-600 transition-colors">
                        {item.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                                {item.createdAt.toLocaleDateString('id-ID', { 
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                </div>
            </div>
            
            {/* Decorative gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryList;