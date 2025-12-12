import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '../utils/fileHelpers';
import { MeetingContext } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
            text: `
            Tugas: Analisis dokumen ini.
            Buat "Panduan Gaya Penulisan" ringkas untuk notulensi (Format Header, Font, penulisan daftar hadir, dll).
            `
          }
        ]
      }
    });

    return response.text || "Gagal menganalisis struktur dokumen.";
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw new Error("Gagal membaca file contoh. Pastikan file tidak rusak.");
  }
};

/**
 * TAHAP 1: Transkripsi Audio per Chunk
 */
export const transcribeAudioChunk = async (
  audioBlob: Blob, 
  context: MeetingContext,
  segmentIndex: number
): Promise<string> => {
  try {
    const audioBase64 = await fileToBase64(audioBlob);
    
    const systemInstruction = `
    Konteks Peserta: ${context.participants}.
    Tugas: Transkrip audio ini secara verbatim (kata per kata).
    - Identifikasi pembicara (contoh: "Budi:", "Ani:").
    - Abaikan suara latar bising.
    - Jangan berikan komentar tambahan, hanya isi percakapan.
    `;

    const response = await generateWithRetry(async () => {
      return await ai.models.generateContent({
        model: MODEL_NAME,
        config: { temperature: 0.1 }, 
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
    return `[Segmen ${segmentIndex + 1}: Data audio terputus/gagal diproses]`;
  }
};

/**
 * TAHAP 2: Finalisasi
 * Diperbarui dengan Sanitizer untuk membuang HTML/Code Blocks
 */
export const generateFinalMinutesFromText = async (
  fullTranscript: string, 
  context: MeetingContext
): Promise<string> => {
  try {
    let styleInstruction = "";
    if (context.styleGuide) {
        styleInstruction = `
        GAYA PENULISAN (STYLE GUIDE):
        ${context.styleGuide}
        `;
    }

    const systemInstruction = `
    Bertindaklah sebagai Notulis Rapat Profesional.
    Buat notulensi resmi dari transkrip berikut.
    
    INFORMASI RAPAT:
    - Judul: ${context.title}
    - Tanggal: ${context.date}
    - Peserta: ${context.participants}
    
    ATURAN FORMAT (STRICT):
    1. Output WAJIB format TEXT MARKDOWN murni.
    2. DILARANG menggunakan tag HTML apapun (JANGAN tulis <html>, <body>, <h1>, <br>, dll).
    3. DILARANG membungkus output dengan "backticks" (JANGAN tulis \`\`\`markdown atau \`\`\`html).
    4. Gunakan formatting: # untuk Judul, ## untuk Sub-judul, - untuk poin, ** untuk tebal.
    
    ${styleInstruction}
    
    TRANSKRIP PERCAKAPAN:
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
    // 1. Hapus pembungkus code block (```markdown ... ```) jika AI bandel
    finalText = finalText.replace(/^```(?:markdown|html)?\s*/i, "").replace(/\s*```$/i, "");
    
    // 2. Hapus tag HTML dasar jika menyelinap (opsional, tapi aman untuk markdown)
    // Menghapus tag <html>, <body>, <head>, <script> agar tampilan bersih
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