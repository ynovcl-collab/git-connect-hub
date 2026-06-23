export type DocumentPdfProps = {
  title: string;
  kind: string;
  body: string;
  recipient?: string;
  issuedAt?: string;
};

const KNOWN_TITLE_PREFIXES = [
  "Title:",
  "Document title:",
  "Titre:",
  "Objet:",
];

export function parseDocumentMessage(text: string): DocumentPdfProps | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let title = "Generated HR document";
  let bodyLines: string[] = [];
  let recipient: string | undefined;
  let kind = "HR document";
  let issuedAt: string | undefined;

  for (const rawLine of lines) {
    if (!rawLine) continue;
    const normalized = rawLine.toLowerCase();
    const titleLabel = KNOWN_TITLE_PREFIXES.find((prefix) => rawLine.startsWith(prefix));
    if (titleLabel) {
      title = rawLine.slice(titleLabel.length).trim();
      continue;
    }

    const titleMatch = rawLine.match(/^\s*(Salary Certificate|Leave Request|Remote[- ]Work Request|Remote-Work Request|Internal Transfer|Loan Attestation|End-of-Contract Certificate|Certificate|Attestation|Request|Letter|Policy|Contract)\s*$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      kind = title;
      continue;
    }

    if (/^recipient[:\-]/i.test(rawLine)) {
      recipient = rawLine.split(/[:\-]/, 2)[1]?.trim();
      continue;
    }
    if (/^issued[:\-]/i.test(rawLine) || /^date[:\-]/i.test(rawLine)) {
      const candidate = rawLine.split(/[:\-]/, 2)[1]?.trim();
      if (candidate) issuedAt = candidate;
    }
    bodyLines.push(rawLine);
  }

  const filteredBody = bodyLines.filter((line) => {
    return !KNOWN_TITLE_PREFIXES.some((prefix) => line.startsWith(prefix)) && !/^recipient[:\-]/i.test(line) && !/^issued[:\-]/i.test(line) && !/^date[:\-]/i.test(line);
  });

  if (filteredBody.length === 0) return null;

  return {
    title: title || "Generated HR document",
    kind,
    body: filteredBody.join("\n"),
    recipient,
    issuedAt,
  };
}
