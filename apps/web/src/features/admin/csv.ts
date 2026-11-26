/**
 * CSV that Excel opens with Vietnamese letters intact. A text cell that a spreadsheet would run as a formula
 * gets a leading quote, so a name typed by a user cannot do anything when the file is opened.
 */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    if (typeof value === 'number') return String(value);
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
