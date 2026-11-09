/**
 * The little the rest of the app needs to know about an opened document: the
 * bytes to export from, the page count, and a way to get a pdf.js page. Kept
 * free of pdf.js imports so the serializer and its tests stay dependency light.
 */
export interface PdfSource {
  name: string;
  /** Original bytes, kept to build the output document with pdf-lib. */
  bytes: ArrayBuffer;
  pageCount: number;
  page(index: number): Promise<unknown>;
}
