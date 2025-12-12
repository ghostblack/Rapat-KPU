import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Download, RefreshCw, FileText } from 'lucide-react';

interface MinutesDisplayProps {
  content: string;
  onReset: () => void;
}

const MinutesDisplay: React.FC<MinutesDisplayProps> = ({ content, onReset }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadWord = () => {
    const element = document.getElementById('markdown-content');
    if (!element) return;

    // Clone element untuk dimanipulasi sebelum export (tanpa mengubah tampilan layar)
    const clone = element.cloneNode(true) as HTMLElement;

    // PEMBERSIHAN HTML:
    
    // 1. Hapus Gambar: Agar dokumen bersih untuk diedit manual (logo dll).
    const images = clone.querySelectorAll('img');
    images.forEach(img => img.remove());
    
    // 2. Hapus Atribut Class: Word kadang bingung dengan class Tailwind/React.
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
        el.removeAttribute('class');
        // Kita biarkan inline style karena ReactMarkdown mungkin nambah style alignment
    });

    // Template HTML khusus agar dikenali Word sebagai dokumen dengan Print Layout & Margin A4
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Notulensi Rapat</title>
        <style>
          /* Setup Halaman A4 */
          @page Section1 {
              size: 595.35pt 841.95pt; /* A4 */
              margin: 2.54cm 2.54cm 2.54cm 2.54cm; /* Margin Normal 1 inci */
              mso-header-margin: 35.4pt; 
              mso-footer-margin: 35.4pt; 
              mso-paper-source: 0;
          }
          div.Section1 { 
              page: Section1; 
              font-family: "Times New Roman", serif;
          }

          /* Styling Dokumen Bersih */
          body { 
            font-family: "Times New Roman", serif; 
            font-size: 12pt; 
            line-height: 1.5; 
            color: #000000;
          }
          
          /* Headings - Rapi & Standar */
          h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 18pt; text-transform: uppercase; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 12pt; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
          
          /* Paragraf & List */
          p { margin-bottom: 12pt; text-align: justify; }
          ul, ol { margin-top: 0; margin-bottom: 12pt; padding-left: 24pt; }
          li { margin-bottom: 4pt; }
          
          /* Tabel - Border Hitam Standar */
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; border: 1px solid #000; }
          td, th { border: 1px solid #000; padding: 5pt; vertical-align: top; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          
          /* Links */
          a { color: #0563c1; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="Section1">
    `;
    
    const postHtml = `
        </div>
      </body>
      </html>
    `;

    // Ambil konten HTML yang sudah dibersihkan
    const innerHtml = clone.innerHTML;
    
    const fullHtml = preHtml + innerHtml + postHtml;

    // Membuat Blob dengan tipe MIME untuk Microsoft Word
    const blob = new Blob(['\ufeff', fullHtml], {
      type: 'application/msword'
    });
    
    // Trigger download
    const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(fullHtml);
    const link = document.createElement('a');
    link.href = url;
    // Gunakan .doc agar lebih kompatibel dengan metode HTML-hack ini
    link.download = `notulensi-${new Date().toISOString().slice(0, 10)}.doc`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-indigo-700 font-semibold">
          <FileText className="w-5 h-5" />
          <h3>Dokumen Hasil</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin' : 'Salin Teks'}
          </button>
          
          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Unduh Word (.doc)
          </button>

          <button
             onClick={onReset}
             className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors ml-2 shadow-sm shadow-indigo-200"
          >
            <RefreshCw className="w-4 h-4" />
            Selesai
          </button>
        </div>
      </div>

      {/* Content Preview - Styled like A4 Paper for Screen */}
      <div className="flex justify-center bg-gray-100 p-4 rounded-xl overflow-auto custom-scrollbar">
        <div 
          id="markdown-content"
          className="bg-white shadow-xl w-full max-w-[21cm] min-h-[29.7cm] p-[2.54cm] text-gray-900"
          style={{ fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.5' }}
        >
          {/* Tampilan di Web - menggunakan class Tailwind tapi di-override oleh style inline saat download */}
          <div className="prose max-w-none prose-headings:font-serif prose-p:font-serif prose-li:font-serif prose-headings:text-black prose-p:text-black prose-li:text-black text-black">
             <ReactMarkdown 
                components={{
                    // Style inline ini PENTING karena akan terbawa ke Word
                    h1: ({node, ...props}) => <h1 style={{textAlign: 'center', marginBottom: '18pt', textTransform: 'uppercase'}} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{marginTop: '18pt', marginBottom: '12pt'}} {...props} />,
                    p: ({node, ...props}) => <p style={{textAlign: 'justify', marginBottom: '12pt'}} {...props} />,
                    li: ({node, ...props}) => <li style={{marginBottom: '4pt'}} {...props} />
                }}
             >
                {content}
             </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinutesDisplay;