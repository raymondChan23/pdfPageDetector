
import * as pdfjsLib from 'pdfjs-dist';

const PDFJS_VERSION = '5.4.449'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export async function getPageCount(blob: Blob): Promise<number> {
  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ 
    data: arrayBuffer,
    useWorkerFetch: true,
    isEvalSupported: false 
  });
  
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

export function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    const cleanFileName = fileName.split('?')[0].split('#')[0];
    return decodeURIComponent(cleanFileName) || 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}
