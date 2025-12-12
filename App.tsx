import React, { useState, useEffect, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import Header from './components/Header';
import AudioRecorder from './components/AudioRecorder';
import MinutesDisplay from './components/MinutesDisplay';
import SetupMeeting from './components/SetupMeeting';
import Login from './components/Login';
import HistoryList from './components/HistoryList';
import { AppStatus, MeetingHistoryItem, MeetingContext } from './types';
import { transcribeAudioChunk, generateFinalMinutesFromText } from './services/geminiService';
import { auth, logOut, subscribeToHistory, initializeMeeting, saveTranscriptChunk, finalizeMeeting } from './services/firebase';
import { Loader2, Plus, Users, FileText, Calendar, ChevronLeft } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizationProgress, setFinalizationProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState<string>(''); 
  const [meetingContext, setMeetingContext] = useState<MeetingContext | null>(null);
  const accumulatedTranscripts = useRef<string[]>([]);
  const processingQueue = useRef<Promise<void>>(Promise.resolve());
  const [history, setHistory] = useState<MeetingHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToHistory(user.uid, (data) => {
        setHistory(data);
      });
      return () => unsubscribe();
    } else {
      setHistory([]);
    }
  }, [user]);

  const handleStartNew = () => {
    setStatus(AppStatus.SETUP);
    setMeetingContext(null);
    setMinutes(null);
    setShowHistory(false);
    setError(null);
    accumulatedTranscripts.current = []; 
    processingQueue.current = Promise.resolve();
    setFinalizationProgress(0);
    setProcessStatus('');
  };

  const handleSetupComplete = async (data: MeetingContext) => {
    if (user) {
        try {
            const meetingId = await initializeMeeting(user.uid, data.title);
            setMeetingContext({ ...data, meetingId }); 
            setStatus(AppStatus.READY);
        } catch (e) {
            console.error(e);
            setError("Gagal menginisialisasi database. Cek koneksi internet.");
        }
    } else {
        setMeetingContext(data);
        setStatus(AppStatus.READY);
    }
  };

  const handleChunkReady = async (audioBlob: Blob) => {
    if (!meetingContext) return;
    setStatus(current => {
        if (current === AppStatus.RECORDING) return AppStatus.PROCESSING_CHUNK;
        return current;
    });

    const segmentNumber = accumulatedTranscripts.current.length + 1;
    const processTask = async () => {
        try {
            setProcessStatus(`Memproses Segmen #${segmentNumber}...`);
            const transcriptText = await transcribeAudioChunk(audioBlob, meetingContext, segmentNumber - 1);
            if (transcriptText) {
                accumulatedTranscripts.current.push(transcriptText);
                if (meetingContext.meetingId) {
                    setProcessStatus(`Menyimpan Segmen #${segmentNumber}...`);
                    await saveTranscriptChunk(meetingContext.meetingId, transcriptText);
                }
            }
        } catch (err) {
            console.error(`Error processing chunk ${segmentNumber}:`, err);
        } finally {
            setStatus(current => {
                if (current === AppStatus.PROCESSING_CHUNK) {
                    setProcessStatus('');
                    return AppStatus.RECORDING;
                }
                return current;
            });
        }
    };
    processingQueue.current = processingQueue.current.then(processTask);
  };

  const handleStopRecording = async () => {
    if (!meetingContext) return;
    setStatus(AppStatus.PROCESSING_FINAL);
    setFinalizationProgress(5); 
    setProcessStatus("Menunggu antrian proses selesai...");

    const progressInterval = setInterval(() => {
        setFinalizationProgress(prev => {
            if (prev >= 90) return 90; 
            return prev + Math.floor(Math.random() * 2) + 1;
        });
    }, 800); 
    
    try {
        await processingQueue.current;
    } catch (queueErr) {
        console.warn("Queue finished with errors", queueErr);
    }
    
    setFinalizationProgress(40); 
    setProcessStatus("Menggabungkan seluruh transkrip...");

    try {
      const fullText = accumulatedTranscripts.current.join("\n\n");
      setFinalizationProgress(50); 
      setProcessStatus("AI sedang menyusun Notulensi...");
      let finalResult = "Tidak ada percakapan yang terdeteksi.";
      if (fullText.trim()) {
         finalResult = await generateFinalMinutesFromText(fullText, meetingContext);
      }
      setFinalizationProgress(85); 
      setProcessStatus("Menyimpan dokumen...");
      setMinutes(finalResult);
      if (meetingContext.meetingId) {
          await finalizeMeeting(meetingContext.meetingId, finalResult);
      }
      setFinalizationProgress(100); 
      setProcessStatus("Selesai!");
      clearInterval(progressInterval);
      setTimeout(() => {
        setStatus(AppStatus.COMPLETED);
        setProcessStatus('');
      }, 500);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError("Gagal: " + (err.message || "Unknown error"));
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setMinutes(null);
    setError(null);
    setShowHistory(true);
    setMeetingContext(null);
    accumulatedTranscripts.current = [];
    processingQueue.current = Promise.resolve();
    setFinalizationProgress(0);
    setProcessStatus('');
  };

  const handleSelectHistory = (item: MeetingHistoryItem) => {
    setMinutes(item.content || (item.transcriptSegments ? item.transcriptSegments.join("\n") : "Data kosong."));
    setStatus(AppStatus.COMPLETED);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat Aplikasi...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      <Header user={user} onLogout={logOut} />
      
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 pb-20">
        
        {/* Intro / Idle State */}
        {status === AppStatus.IDLE && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="text-center space-y-3 pt-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Halo, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{user.displayName?.split(' ')[0] || 'Admin'}</span>
              </h2>
              <p className="text-base sm:text-lg text-gray-600 max-w-md mx-auto leading-relaxed">
                Siap mencatat rapat hari ini? AI akan membantu membuat notulensi secara otomatis.
              </p>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={handleStartNew}
                className="group flex items-center gap-3 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center"
              >
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                Buat Notulensi Baru
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Setup Meeting */}
        {status === AppStatus.SETUP && (
          <SetupMeeting 
            onNext={handleSetupComplete}
            onCancel={handleReset}
          />
        )}

        {/* Step 2: Recorder Section */}
        {(status === AppStatus.READY || status === AppStatus.RECORDING || status === AppStatus.PROCESSING_CHUNK || status === AppStatus.PROCESSING_FINAL) && meetingContext && (
           <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
             
             {/* Mobile-friendly Info Badge */}
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg leading-tight">
                    <FileText className="w-5 h-5 shrink-0" />
                    <span className="truncate">{meetingContext.title}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                     <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{meetingContext.date}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{meetingContext.participants.split(',').length} Peserta</span>
                     </div>
                </div>
             </div>

             <AudioRecorder 
               status={status}
               progress={finalizationProgress}
               processingStatus={processStatus}
               onStartRecording={() => setStatus(AppStatus.RECORDING)}
               onChunkReady={handleChunkReady}
               onStopRecording={handleStopRecording}
               error={error}
             />
           </div>
        )}

        {/* Step 3: Results Section */}
        {status === AppStatus.COMPLETED && minutes && (
          <div className="space-y-4">
             <button 
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors pl-1"
             >
                <ChevronLeft className="w-4 h-4" />
                Kembali ke Beranda
             </button>
             <MinutesDisplay content={minutes} onReset={handleReset} />
          </div>
        )}

        {/* Step 4: Error Display */}
        {status === AppStatus.ERROR && error && (
             <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
                <div className="text-red-600 font-bold text-lg">Terjadi Kesalahan</div>
                <p className="text-gray-600 text-sm leading-relaxed">{error}</p>
                <div className="flex justify-center gap-3 pt-2">
                    <button onClick={handleReset} className="text-gray-600 font-medium text-sm hover:underline px-4 py-2">Batal</button>
                    {accumulatedTranscripts.current.length > 0 && (
                        <button 
                            onClick={() => {
                                const backupText = accumulatedTranscripts.current.join("\n\n");
                                setMinutes(backupText);
                                setStatus(AppStatus.COMPLETED);
                            }} 
                            className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                        >
                            Lihat Transkrip Mentah
                        </button>
                    )}
                </div>
             </div>
        )}

        {/* History Section */}
        {status === AppStatus.IDLE && showHistory && (
          <div className="mt-2 animate-in slide-in-from-bottom-10 duration-700 delay-150">
            <HistoryList history={history} onSelect={handleSelectHistory} />
          </div>
        )}

      </main>
      
      {status === AppStatus.IDLE && (
         <footer className="py-6 text-center text-xs text-gray-400 mt-auto pb-8">
            <p className="mb-1">&copy; {new Date().getFullYear()} KPU Notulensi System</p>
            <p>Powered by Gemini 2.5 Flash</p>
         </footer>
      )}
    </div>
  );
};

export default App;