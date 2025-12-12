export enum AppStatus {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  READY = 'READY',
  RECORDING = 'RECORDING',
  PROCESSING_CHUNK = 'PROCESSING_CHUNK', // Status baru: memproses potongan, tapi tetap merekam
  PROCESSING_FINAL = 'PROCESSING_FINAL',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface MeetingContext {
  meetingId?: string; // ID dari Firebase
  title: string;
  date: string;
  participants: string;
  referenceFile: File | null;
  styleGuide?: string;
}

export interface MeetingResult {
  rawTranscript: string;
  structuredMinutes: string;
}

export interface AudioVisualizerData {
  dataArray: Uint8Array;
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  userId: string;
  transcriptSegments?: string[]; // Array transkrip per jam
  status?: 'live' | 'completed';
}