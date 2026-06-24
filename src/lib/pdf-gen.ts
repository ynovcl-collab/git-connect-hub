import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import { DocumentPdfProps } from "./document-utils";

/* ============================================================
 * Polished LaTeX-inspired HR document renderer.
 *  - Times-family body (serif, formal)
 *  - Helvetica for kicker / footer (sans, technical)
 *  - Parses light Markdown coming from the AI:
 *      # / ## / ### headings, **bold**, *italic*, _italic_,
 *      lists (- / * / 1.), --- horizontal rule, blockquotes (>)
 *  - Justified paragraphs with proper margins and signature block
 * ============================================================ */

function sanitizeFileName(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "wasl-document";
}

function stripMd(s: string) {
  return s.replace(/`{1,3}([^`]+)`{1,3}/g, "$1").replace(/~~([^~]+)~~/g, "$1");
}

type Run = { text: string; bold: boolean; italic: boolean };

function parseInline(text: string): Run[] {
  // Tokenize **bold**, *italic*, _italic_
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false, italic: false });
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push({ text: tok.slice(2, -2), bold: true, italic: false });
    } else {
      out.push({ text: tok.slice(1, -1), bold: false, italic: true });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false, italic: false });
  return out.map((r) => ({ ...r, text: stripMd(r.text) }));
}

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "space" };

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  let listBuf: string[] = [];
  let listKind: "ul" | "ol" | null = null;

  const flushPara = () => {
    if (buf.length) {
      blocks.push({ kind: "p", text: buf.join(" ").replace(/\s+/g, " ").trim() });
      buf = [];
    }
  };
  const flushList = () => {
    if (listKind && listBuf.length) blocks.push({ kind: listKind, items: listBuf.slice() });
    listBuf = [];
    listKind = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) {
      flushPara();
      flushList();
      blocks.push({ kind: "space" });
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ kind: (`h${level}` as "h1" | "h2" | "h3"), text: stripMd(h[2].trim()) });
      continue;
    }
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      flushPara();
      flushList();
      blocks.push({ kind: "quote", text: stripMd(bq[1].trim()) });
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (listKind && listKind !== kind) flushList();
      listKind = kind;
      listBuf.push((ul ?? ol)![1].trim());
      continue;
    }
    flushList();
    buf.push(line.trim());
  }
  flushPara();
  flushList();
  // Trim leading/trailing whitespace blocks
  while (blocks.length && blocks[0].kind === "space") blocks.shift();
  while (blocks.length && blocks[blocks.length - 1].kind === "space") blocks.pop();
  return blocks;
}

// ---- Layout primitives ----
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 64;
const MARGIN_TOP = 90;
const MARGIN_BOTTOM = 80;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const COLOR_INK: RGB = rgb(0.09, 0.10, 0.14);
const COLOR_MUTED: RGB = rgb(0.42, 0.46, 0.52);
const COLOR_ACCENT: RGB = rgb(0.13, 0.18, 0.42); // deep navy, matches app accent
const COLOR_RULE: RGB = rgb(0.78, 0.80, 0.84);

type Fonts = {
  body: PDFFont; bold: PDFFont; italic: PDFFont; bi: PDFFont;
  sans: PDFFont; sansBold: PDFFont;
};

function pickFont(run: Run, f: Fonts): PDFFont {
  if (run.bold && run.italic) return f.bi;
  if (run.bold) return f.bold;
  if (run.italic) return f.italic;
  return f.body;
}

function wrapRuns(runs: Run[], font: PDFFont, size: number, maxWidth: number): Run[][] {
  // Word-wrap, preserving formatting
  const tokens: { text: string; bold: boolean; italic: boolean; isSpace: boolean }[] = [];
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      tokens.push({ text: p, bold: r.bold, italic: r.italic, isSpace: /^\s+$/.test(p) });
    }
  }
  const lines: Run[][] = [];
  let cur: Run[] = [];
  let curW = 0;
  const widthOf = (t: { text: string; bold: boolean; italic: boolean }, fonts?: Fonts) => {
    const fn = fonts ? pickFont(t as Run, fonts) : font;
    return fn.widthOfTextAtSize(t.text, size);
  };
  for (const t of tokens) {
    const w = widthOf(t);
    if (t.isSpace && cur.length === 0) continue; // skip leading space
    if (curW + w > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = [];
      curW = 0;
      if (t.isSpace) continue;
    }
    cur.push({ text: t.text, bold: t.bold, italic: t.italic });
    curW += w;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function drawLine(page: PDFPage, runs: Run[], x: number, y: number, size: number, fonts: Fonts, color: RGB) {
  let cx = x;
  for (const r of runs) {
    const fn = pickFont(r, fonts);
    page.drawText(r.text, { x: cx, y, size, font: fn, color });
    cx += fn.widthOfTextAtSize(r.text, size);
  }
}

function drawHeader(page: PDFPage, fonts: Fonts, kind: string) {
  // Double rule + brand
  page.drawLine({ start: { x: MARGIN_X, y: PAGE_H - 50 }, end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 50 }, thickness: 0.6, color: COLOR_RULE });
  page.drawLine({ start: { x: MARGIN_X, y: PAGE_H - 53 }, end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 53 }, thickness: 0.3, color: COLOR_RULE });
  page.drawText("WASL  ·  HUMANAI HR", { x: MARGIN_X, y: PAGE_H - 42, size: 8, font: fonts.sansBold, color: COLOR_ACCENT });
  page.drawText(kind.toUpperCase(), { x: PAGE_W - MARGIN_X - fonts.sans.widthOfTextAtSize(kind.toUpperCase(), 8), y: PAGE_H - 42, size: 8, font: fonts.sans, color: COLOR_MUTED });
}

function drawFooter(page: PDFPage, fonts: Fonts, pageNum: number, totalPages: number) {
  const txt = `Issued by HR  ·  Wasl by Humanai  ·  Confidential  ·  Page ${pageNum} / ${totalPages}`;
  const w = fonts.sans.widthOfTextAtSize(txt, 7.5);
  page.drawLine({ start: { x: MARGIN_X, y: 54 }, end: { x: PAGE_W - MARGIN_X, y: 54 }, thickness: 0.4, color: COLOR_RULE });
  page.drawText(txt, { x: (PAGE_W - w) / 2, y: 40, size: 7.5, font: fonts.sans, color: COLOR_MUTED });
}

export async function createPdfBlob(opts: DocumentPdfProps): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const fonts: Fonts = {
    body: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    bi: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
    sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
    sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  drawHeader(page, fonts, opts.kind);
  let y = PAGE_H - MARGIN_TOP;

  // Title block
  const kicker = (opts.kind || "HR document").toUpperCase();
  page.drawText(kicker, { x: MARGIN_X, y, size: 8.5, font: fonts.sansBold, color: COLOR_ACCENT });
  y -= 18;
  // Title (multi-line)
  const titleSize = 22;
  const titleLines = wrapRuns([{ text: opts.title, bold: true, italic: false }], fonts.bold, titleSize, CONTENT_W);
  for (const line of titleLines) {
    drawLine(page, line, MARGIN_X, y, titleSize, fonts, COLOR_INK);
    y -= titleSize * 1.15;
  }
  // Decorative underline
  y -= 4;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 48, y }, thickness: 1.2, color: COLOR_ACCENT });
  y -= 14;

  // Meta row
  const meta: string[] = [];
  if (opts.issuedAt) meta.push(`Issued: ${opts.issuedAt}`);
  if (opts.recipient) meta.push(`Recipient: ${opts.recipient}`);
  if (meta.length) {
    page.drawText(meta.join("    ·    "), { x: MARGIN_X, y, size: 9, font: fonts.sans, color: COLOR_MUTED });
    y -= 22;
  } else {
    y -= 8;
  }

  // Body blocks
  const blocks = parseBlocks(opts.body || "");

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      drawHeader(page, fonts, opts.kind);
      y = PAGE_H - MARGIN_TOP;
    }
  };

  const renderRuns = (runs: Run[], size: number, leading: number, indent = 0, color: RGB = COLOR_INK, font: PDFFont = fonts.body) => {
    const lines = wrapRuns(runs, font, size, CONTENT_W - indent);
    for (const line of lines) {
      ensureSpace(leading);
      drawLine(page, line, MARGIN_X + indent, y, size, fonts, color);
      y -= leading;
    }
  };

  for (const b of blocks) {
    if (b.kind === "space") {
      y -= 8;
      continue;
    }
    if (b.kind === "hr") {
      ensureSpace(18);
      page.drawLine({ start: { x: MARGIN_X + 30, y: y - 4 }, end: { x: PAGE_W - MARGIN_X - 30, y: y - 4 }, thickness: 0.6, color: COLOR_RULE });
      y -= 18;
      continue;
    }
    if (b.kind === "h1") {
      y -= 6;
      renderRuns([{ text: b.text, bold: true, italic: false }], 15, 20, 0, COLOR_INK, fonts.bold);
      continue;
    }
    if (b.kind === "h2") {
      y -= 4;
      renderRuns([{ text: b.text, bold: true, italic: false }], 13, 18, 0, COLOR_ACCENT, fonts.bold);
      continue;
    }
    if (b.kind === "h3") {
      y -= 2;
      renderRuns([{ text: b.text, bold: true, italic: false }], 11.5, 16, 0, COLOR_INK, fonts.bold);
      continue;
    }
    if (b.kind === "p") {
      renderRuns(parseInline(b.text), 11, 15.5, 0);
      y -= 4;
      continue;
    }
    if (b.kind === "quote") {
      ensureSpace(18);
      const startY = y;
      const runs = parseInline(b.text);
      renderRuns(runs, 10.5, 15, 16, COLOR_MUTED, fonts.italic);
      page.drawLine({ start: { x: MARGIN_X + 4, y: startY + 4 }, end: { x: MARGIN_X + 4, y: y + 6 }, thickness: 1.6, color: COLOR_ACCENT });
      y -= 4;
      continue;
    }
    if (b.kind === "ul" || b.kind === "ol") {
      for (let i = 0; i < b.items.length; i++) {
        const marker = b.kind === "ul" ? "•" : `${i + 1}.`;
        ensureSpace(15.5);
        page.drawText(marker, { x: MARGIN_X + 4, y, size: 11, font: fonts.bold, color: COLOR_ACCENT });
        renderRuns(parseInline(b.items[i]), 11, 15.5, 22);
      }
      y -= 4;
      continue;
    }
  }

  // Signature block
  y -= 18;
  ensureSpace(80);
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 180, y }, thickness: 0.6, color: COLOR_INK });
  page.drawLine({ start: { x: PAGE_W - MARGIN_X - 180, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 0.6, color: COLOR_INK });
  y -= 12;
  page.drawText("HR Officer", { x: MARGIN_X, y, size: 9, font: fonts.sansBold, color: COLOR_INK });
  const rightLabel = "Authorised signature";
  page.drawText(rightLabel, { x: PAGE_W - MARGIN_X - fonts.sans.widthOfTextAtSize(rightLabel, 9), y, size: 9, font: fonts.sans, color: COLOR_MUTED });
  y -= 11;
  page.drawText("Wasl by Humanai", { x: MARGIN_X, y, size: 8, font: fonts.sans, color: COLOR_MUTED });

  // Footers with total page count
  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, fonts, i + 1, total));

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
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
