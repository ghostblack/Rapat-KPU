import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '../utils/fileHelpers';
import { MeetingContext } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Gunakan model Flash terbaru yang lebih cepat dan murah
const MODEL_NAME = "gemini-2.5-flash";

// Helper untuk Retry Mechanism
const generateWithRetry = async (apiCall: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`API Fail, retrying... (${retries} left)`, error);
      await new Promise(res => setTimeout(res, delay));
      return generateWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const analyzeDocumentStyle = async (file: File): Promise<string> => {
  try {
    const fileBase64 = await fileToBase64(file);
    const mimeType = file.type || 'application/pdf';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: fileBase64 } },
          {
            text: `Analisis format penulisan dokumen ini untuk panduan notulensi.`
          }
        ]
      }
    });

    return response.text || "Gagal menganalisis struktur dokumen.";
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw new Error("Gagal membaca file contoh.");
  }
};

/**
 * TAHAP 1: Transkripsi Audio per Chunk
 * OPTIMASI: System Instruction dipersingkat untuk menghemat Token Input.
 */
export const transcribeAudioChunk = async (
  audioBlob: Blob, 
  context: MeetingContext,
  segmentIndex: number
): Promise<string> => {
  try {
    const audioBase64 = await fileToBase64(audioBlob);
    
    // Prompt sangat ringkas untuk hemat biaya
    const systemInstruction = `Transkrip audio rapat ini. Peserta: ${context.participants}. Format: Nama: Ucapan.`;

    const response = await generateWithRetry(async () => {
      return await ai.models.generateContent({
        model: MODEL_NAME,
        config: { 
            temperature: 0.1,
            // Naikkan limit token karena 15 menit audio menghasilkan banyak teks
            // Jika terlalu rendah, transkrip akan terpotong di tengah.
            maxOutputTokens: 8192, 
        }, 
        contents: {
          parts: [
            { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: audioBase64 } },
            { text: systemInstruction }
          ]
        }
      });
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing chunk:", error);
    return `[Segmen ${segmentIndex + 1}: Data audio terputus]`;
  }
};

/**
 * TAHAP 2: Finalisasi
 * OPTIMASI: Prompt diringkas.
 */
export const generateFinalMinutesFromText = async (
  fullTranscript: string, 
  context: MeetingContext
): Promise<string> => {
  try {
    let styleInstruction = "";
    if (context.styleGuide) {
        styleInstruction = `Gaya: ${context.styleGuide.substring(0, 500)}`; // Batasi panjang style guide
    }

    // Prompt dioptimalkan agar tidak boros token
    const systemInstruction = `
    Buat notulensi rapat resmi format Markdown.
    
    Info:
    - Judul: ${context.title}
    - Tanggal: ${context.date}
    - Peserta: ${context.participants}
    
    ${styleInstruction}
    
    Transkrip:
    ${fullTranscript}
    `;

    const response = await generateWithRetry(async () => {
        return await ai.models.generateContent({
            model: MODEL_NAME, 
            config: { temperature: 0.3 },
            contents: {
                parts: [{ text: systemInstruction }]
            }
        });
    });

    let finalText = response.text || "Gagal membuat notulensi akhir.";

    // --- PEMBERSIH / SANITIZER ---
    finalText = finalText.replace(/^```(?:markdown|html)?\s*/i, "").replace(/\s*```$/i, "");
    finalText = finalText.replace(/<(html|head|body|script|style)[^>]*>/gi, "");
    finalText = finalText.replace(/<\/(html|head|body|script|style)>/gi, "");

    return finalText.trim();

  } catch (error) {
    console.error("Error generating final minutes:", error);
    throw error;
  }
};

// Deprecated
export const generateMeetingMinutes = async (audioBlob: Blob, context: MeetingContext): Promise<string> => {
    const transcript = await transcribeAudioChunk(audioBlob, context, 0);
    return generateFinalMinutesFromText(transcript, context);
};