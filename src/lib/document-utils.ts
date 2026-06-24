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
  const defaultTitle = `HR Document — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  let title = defaultTitle;
  let titleSet = false;
  const bodyLines: string[] = [];
  let recipient: string | undefined;
  let kind = "HR document";
  let issuedAt: string | undefined;

  for (const rawLine of lines) {
    if (!rawLine) { bodyLines.push(""); continue; }
    const titleLabel = KNOWN_TITLE_PREFIXES.find((prefix) => rawLine.toLowerCase().startsWith(prefix.toLowerCase()));
    if (titleLabel) {
      title = rawLine.slice(titleLabel.length).trim();
      titleSet = true;
      continue;
    }

    // Heading line (markdown style or known doc type)
    const mdHeading = rawLine.match(/^#{1,3}\s+(.+)$/);
    if (!titleSet && mdHeading) {
      title = mdHeading[1].trim();
      kind = title;
      titleSet = true;
      continue;
    }

    const titleMatch = rawLine.match(/^\s*(Salary Certificate|Leave Request|Remote[- ]Work Request|Remote-Work Request|Internal Transfer|Loan Attestation|End-of-Contract Certificate|Employment Certificate|Training Certificate|Certificate|Attestation|Request|Letter|Policy|Contract)(?:\s*[—\-:]\s*.+)?$/i);
    if (!titleSet && titleMatch) {
      title = rawLine.trim();
      kind = titleMatch[1].trim();
      titleSet = true;
      continue;
    }

    if (/^recipient[:\-]/i.test(rawLine)) {
      recipient = rawLine.split(/[:\-]/, 2)[1]?.trim();
      continue;
    }
    if (/^issued[:\-]/i.test(rawLine) || /^date[:\-]/i.test(rawLine)) {
      const candidate = rawLine.split(/[:\-]/, 2)[1]?.trim();
      if (candidate) issuedAt = candidate;
      continue;
    }
    bodyLines.push(rawLine);
  }

  // Drop any leftover meta lines
  const filteredBody = bodyLines.filter((line) => {
    return !KNOWN_TITLE_PREFIXES.some((prefix) => line.toLowerCase().startsWith(prefix.toLowerCase()))
      && !/^recipient[:\-]/i.test(line)
      && !/^issued[:\-]/i.test(line)
      && !/^date[:\-]/i.test(line);
  });

  // Trim leading/trailing blanks
  while (filteredBody.length && !filteredBody[0]) filteredBody.shift();
  while (filteredBody.length && !filteredBody[filteredBody.length - 1]) filteredBody.pop();

  if (filteredBody.length === 0) return null;

  return {
    title: title || defaultTitle,
    kind,
    body: filteredBody.join("\n"),
    recipient,
    issuedAt: issuedAt ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  };
}
