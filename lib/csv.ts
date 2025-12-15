function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) lines.push(row.map((cell) => escapeCsvCell(cell ?? '')).join(','));
  // UTF-8 BOM for Excel
  return `\uFEFF${lines.join('\n')}\n`;
}

