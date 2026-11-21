import type { Transaction } from '../store/user';

/** Transactions → CSV that opens correctly in Excel for the user's locale.
    Greek Excel expects ';' separators and ',' decimals. */
export function transactionsCsv(txs: Transaction[], lang: 'el' | 'en'): string {
  const sep = lang === 'el' ? ';' : ',';
  const num = (v: number) => (lang === 'el' ? String(v).replace('.', ',') : String(v));
  const cell = (v: string) => {
    // Neutralise spreadsheet formulas (CSV injection) and quote safely
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /["\n\r;,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = lang === 'el'
    ? ['Ημερομηνία', 'Τύπος', 'Νόμισμα', 'Σύμβολο', 'Ποσότητα', 'Τιμή (USD)', 'Σύνολο (USD)', 'Σημείωση']
    : ['Date', 'Type', 'Coin', 'Symbol', 'Amount', 'Price (USD)', 'Total (USD)', 'Note'];
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => [
      cell(x.date.replace('T', ' ').slice(0, 19)),
      cell(x.type),
      cell(x.name),
      cell(x.symbol.toUpperCase()),
      num(x.amount),
      num(x.price),
      num(+(x.amount * x.price).toFixed(8)),
      cell(x.note ?? ''),
    ].join(sep));
  return '﻿' + [header.map(cell).join(sep), ...rows].join('\r\n');
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
