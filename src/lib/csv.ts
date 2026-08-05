/** Minimal, dependency-free CSV serialize/parse with quote handling. */

export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return columns ? columns.join(",") + "\n" : "";
  const cols = columns ?? Object.keys(rows[0]);
  const head = cols.map(escapeCell).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c] ?? "")).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
}

function escapeCell(value: unknown): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Parse CSV into an array of row objects keyed by the header row. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      // Only treat a quote as opening a quoted field when it's the very
      // first character of the field — a bare `"` elsewhere in an unquoted
      // field is a literal character, not a mode toggle (otherwise it would
      // swallow everything up to the next stray quote, including newlines).
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Trigger a client-side file download. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
