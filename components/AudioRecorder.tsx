import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle, Save, BarChart3 } from 'lucide-react';
import { AppStatus } from '../types';
import { formatDuration } from '../utils/audioHelpers';

interface AudioRecorderProps {
  status: AppStatus;
  progress?: number; 
  processingStatus?: string;
  onStartRecording: () => void;
  onStopRecording: () => void; 
  onChunkReady: (blob: Blob) => void; 
  error?: string | null;
}

// PERBAIKAN: Dikurangi jadi 2 menit (120.000 ms). 
// 10 menit terlalu besar untuk upload base64 dan rentan timeout/canceled.
const CHUNK_INTERVAL_MS = 2 * 60 * 1000; 

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  status, 
  progress = 0, 
  processingStatus = '', 
  onStartRecording, 
  onStopRecording, 
  onChunkReady, 
  error 
}) => {
  const [duration, setDuration] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const chunkTimerRef = useRef<number | null>(null); 
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupAudioResources = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
  };

  const startVisualizer = () => {
    if (!canvasRef.current || !streamRef.current || !containerRef.current) return;
    
    // Resize canvas to fit container dynamically
    const container = containerRef.current;
    canvasRef.current.width = container.offsetWidth;
    canvasRef.current.height = container.offsetHeight;

    const stream = streamRef.current;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 128; // Lower fftSize for thicker bars suitable for mobile
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!ctx || !analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Use clearRect for transparent bg
        
        const barWidth = (canvas.width / bufferLength) * 2;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.9; // Scale height
          
          // Modern rounded pill gradient
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          gradient.addColorStop(0, '#6366f1'); // Indigo 500
          gradient.addColorStop(1, '#a5b4fc'); // Indigo 300
          
          ctx.fillStyle = gradient;
          
          // Draw rounded top bars
          if (barHeight > 0) {
              ctx.beginPath();
              ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
              ctx.fill();
          }
          
          x += barWidth;
        }
      };
      draw();
    } catch (e) { console.warn("Visualizer failed", e); }
  };

  const startRecordingStream = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Mic not supported");
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/mp4';

      // Menggunakan timeslice kecil di start(1000) untuk memastikan data tersedia
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorder.start(1000); 
      return mediaRecorder;
  };

  const handleStart = async () => {
    setLocalError(null);
    try {
      await startRecordingStream();
      onStartRecording(); 
      
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      chunkTimerRef.current = window.setInterval(() => {
        restartRecordingForChunking();
      }, CHUNK_INTERVAL_MS);

    } catch (err: any) {
      console.error("Mic Error", err);
      setLocalError("Gagal akses mikrofon.");
    }
  };

  const restartRecordingForChunking = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // Stop current recorder to finalize blob
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
            
            // Kirim blob ke parent (App.tsx)
            if (blob.size > 0) {
                onChunkReady(blob);
            }
            
            // Reset chunks
            chunksRef.current = [];
            
            // Start new recorder immediately with same stream
            try {
                if (streamRef.current) {
                    const mimeType = mediaRecorderRef.current?.mimeType;
                    const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
                    mediaRecorderRef.current = newRecorder;
                    newRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                    newRecorder.start(1000);
                }
            } catch (e) {
                console.error("Failed to restart recorder", e);
                setLocalError("Gagal rekaman otomatis.");
            }
        };
        mediaRecorderRef.current.stop();
    }
  };

  const handleManualStop = () => {
    if (chunkTimerRef.current) { clearInterval(chunkTimerRef.current); chunkTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
         const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
         onChunkReady(blob);
         if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
         cleanupAudioResources();
         onStopRecording();
      };
      mediaRecorderRef.current.stop();
    }
  };

  const isRecording = status === AppStatus.RECORDING || status === AppStatus.PROCESSING_CHUNK;
  const isProcessingFinal = status === AppStatus.PROCESSING_FINAL;

  useEffect(() => {
    if (isRecording && streamRef.current) {
        setTimeout(() => startVisualizer(), 100);
        const handleResize = () => {
           if(canvasRef.current && containerRef.current) {
               canvasRef.current.width = containerRef.current.offsetWidth;
               canvasRef.current.height = containerRef.current.offsetHeight;
           }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      cleanupAudioResources();
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl shadow-gray-100 border border-white overflow-hidden relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

      <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-6">
        
        {/* Status Header */}
        <div className="text-center space-y-2 z-10">
          <h2 className={`text-2xl font-bold transition-colors ${isRecording ? 'text-indigo-600' : 'text-gray-900'}`}>
            {isRecording ? 'Sedang Merekam' : isProcessingFinal ? 'Finalisasi...' : 'Siap Merekam'}
          </h2>
          <div className="h-6 flex items-center justify-center">
             {processingStatus ? (
                 <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {processingStatus}
                 </span>
             ) : (
                 <span className="text-sm text-gray-500">
                    {isRecording ? 'AI mendengarkan...' : isProcessingFinal ? 'Jangan tutup aplikasi.' : 'Pastikan mikrofon aktif.'}
                 </span>
             )}
          </div>
        </div>

        {/* Visualizer Area */}
        <div ref={containerRef} className="relative w-full h-40 bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100 flex items-end justify-center">
            {isRecording ? (
                <canvas ref={canvasRef} className="w-full h-full" />
            ) : isProcessingFinal ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center w-full px-8">
                     <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }}></div>
                     </div>
                     <span className="text-xs font-semibold text-indigo-600">{progress}% Selesai</span>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-300 gap-3">
                   <BarChart3 className="w-12 h-12 opacity-20" />
                   <span className="text-sm font-medium opacity-40">Visualizer Area</span>
                </div>
            )}
            
            {/* Live Timer Pill */}
            {isRecording && (
                <div className="absolute top-3 right-3 bg-red-500/10 backdrop-blur-sm border border-red-500/20 text-red-600 px-3 py-1 rounded-full text-sm font-mono font-bold flex items-center gap-2 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    {formatDuration(duration)}
                </div>
            )}

            {/* Auto Save Pill */}
            {status === AppStatus.PROCESSING_CHUNK && !processingStatus && (
                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm animate-in slide-in-from-left-2">
                    <Save className="w-3 h-3" />
                    Menyimpan...
                </div>
            )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-6 mt-2">
          {!isRecording && !isProcessingFinal && (
            <button
              onClick={handleStart}
              className="group relative flex items-center justify-center w-20 h-20 bg-indigo-600 hover:bg-indigo-700 rounded-[2rem] transition-all shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95"
            >
              <Mic className="w-8 h-8 text-white" />
              <div className="absolute inset-0 rounded-[2rem] ring-4 ring-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          )}

          {isRecording && (
            <button
              onClick={handleManualStop}
              className="group relative flex items-center justify-center w-20 h-20 bg-white border-2 border-red-100 hover:border-red-200 rounded-[2rem] transition-all shadow-lg hover:shadow-red-100 active:scale-95"
            >
              <div className="w-8 h-8 bg-red-500 rounded-lg group-hover:rounded-md transition-all shadow-sm"></div>
              <span className="absolute -bottom-8 text-xs font-bold text-red-400 uppercase tracking-widest">Stop</span>
            </button>
          )}

          {isProcessingFinal && (
            <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-50 border-t-indigo-600 flex items-center justify-center bg-white shadow-inner">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
            </div>
          )}
        </div>
        
        {(error || localError) && (
            <div className="w-full bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-start gap-3 text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error || localError}</span>
            </div>
        )}

      </div>
    </div>
  );
};

export default AudioRecorder;