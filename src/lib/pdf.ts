import { downloadPdf } from "./pdf-gen";
import { DocumentPdfProps } from "./document-utils";

export function openPrintablePdf(opts: DocumentPdfProps) {
  void downloadPdf(opts);
}
