// Minimal CSV export helper shared by the admin lookups.
// Values are stringified and quoted if they contain a comma, quote or newline.
// RFC-4180 style escaping.

const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
};

export const downloadCsv = (filename, headers, rows) => {
    const lines = [];
    if (headers && headers.length) {
        lines.push(headers.map(escapeCell).join(','));
    }
    for (const row of rows || []) {
        lines.push(row.map(escapeCell).join(','));
    }
    // Prepend BOM so Excel opens UTF-8 correctly.
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
};
