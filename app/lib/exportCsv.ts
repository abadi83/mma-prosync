/**
 * Ekspor data ke format CSV dan trigger download di browser.
 */

export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'; // BOM untuk encoding UTF-8 di Excel
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','));
  const csv = bom + [headerLine, ...dataLines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
