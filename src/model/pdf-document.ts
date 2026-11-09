import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfSource } from './pdf-source';

// One global worker for the whole app. Without it pdf.js parses and renders on
// the main thread and the UI (or the window manager) appears frozen.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfDocumentSource extends PdfSource {
  page(index: number): Promise<pdfjs.PDFPageProxy>;
}

export async function openPdf(file: File): Promise<PdfDocumentSource> {
  const bytes = await file.arrayBuffer();
  const document = await pdfjs.getDocument({
    // pdf.js detaches the buffer it is given, so hand it a copy and keep ours.
    data: new Uint8Array(bytes.slice(0)),
  }).promise;
  return {
    name: file.name,
    bytes,
    pageCount: document.numPages,
    page: (index) => document.getPage(index + 1),
  };
}
