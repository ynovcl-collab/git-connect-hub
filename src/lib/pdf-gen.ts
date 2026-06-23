import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DocumentPdfProps } from "./document-utils";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "wasl-document";
}

export async function createPdfBlob(opts: DocumentPdfProps): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  let y = 820;

  page.drawText("WASL by Humanai", { x: margin, y, size: 10, font: helveticaBold, color: rgb(0.08, 0.1, 0.18) });
  y -= 16;
  page.drawText("Confidential HR document", { x: margin, y, size: 8, font: helvetica, color: rgb(0.36, 0.40, 0.46) });
  y -= 30;

  page.drawText(opts.kind.toUpperCase(), { x: margin, y, size: 10, font: helveticaBold, color: rgb(0.20, 0.34, 0.79) });
  y -= 18;
  page.drawText(opts.title, { x: margin, y, size: 20, font: helveticaBold, color: rgb(0.08, 0.1, 0.18) });
  y -= 28;

  if (opts.recipient) {
    page.drawText(`Recipient: ${opts.recipient}`, { x: margin, y, size: 10, font: helvetica, color: rgb(0.08, 0.1, 0.18) });
    y -= 18;
  }
  if (opts.issuedAt) {
    page.drawText(`Issued: ${opts.issuedAt}`, { x: margin, y, size: 10, font: helvetica, color: rgb(0.08, 0.1, 0.18) });
    y -= 20;
  }

  const bodyLines = opts.body.split(/\r?\n/);
  const textSize = 11;
  const maxWidth = page.getWidth() - margin * 2;
  const lineHeight = 15;

  for (const line of bodyLines) {
    const words = line.split(" ");
    let lineText = "";
    for (const word of words) {
      const candidate = lineText ? `${lineText} ${word}` : word;
      const width = helvetica.widthOfTextAtSize(candidate, textSize);
      if (width > maxWidth) {
        page.drawText(lineText, { x: margin, y, size: textSize, font: helvetica, color: rgb(0.08, 0.1, 0.18) });
        y -= lineHeight;
        lineText = word;
        if (y < margin + 60) {
          page.addPage();
          y = 820;
        }
      } else {
        lineText = candidate;
      }
    }
    if (lineText) {
      page.drawText(lineText, { x: margin, y, size: textSize, font: helvetica, color: rgb(0.08, 0.1, 0.18) });
      y -= lineHeight;
      if (y < margin + 60) {
        page.addPage();
        y = 820;
      }
    }
  }

  y -= 28;
  page.drawText("HR Officer", { x: margin, y, size: 10, font: helveticaBold, color: rgb(0.08, 0.1, 0.18) });
  page.drawText("Authorised signature", { x: margin + 300, y, size: 10, font: helvetica, color: rgb(0.36, 0.40, 0.46) });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

export async function downloadPdf(opts: DocumentPdfProps) {
  const blob = await createPdfBlob(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(opts.title)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
