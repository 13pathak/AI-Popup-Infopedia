// Builds a small valid 3-page PDF with correct xref offsets for viewer
// testing. Run: node tests/make-test-pdf.js > tests/test_highlight.pdf
const pagesText = [
  ['Page one sample text alpha beta', 'gamma delta epsilon zeta'],
  ['Page two sample text eta theta', 'iota kappa lambda mu'],
  ['Page three nu xi omicron', 'pi rho sigma tau']
];

// Object layout: 1 Catalog, 2 Pages, 3-5 Page dicts, 6-8 content
// streams, 9 font.
const contentStreams = pagesText.map(lines =>
  'BT /F1 24 Tf 72 700 Td ' +
  lines.map(l => `(${l}) Tj 0 -40 Td`).join(' ').replace(/ Tj 0 -40 Td$/, ' Tj') + ' ET');

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
  ...pagesText.map((lines, i) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents ${6 + i} 0 R >>`),
  ...contentStreams.map(s => ({ stream: s })),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
];

let out = '%PDF-1.4\n';
const offsets = [];
for (let i = 0; i < objects.length; i++) {
  offsets.push(out.length);
  const num = i + 1;
  const obj = objects[i];
  if (obj && typeof obj === 'object' && obj.stream !== undefined) {
    out += `${num} 0 obj\n<< /Length ${Buffer.byteLength(obj.stream)} >>\nstream\n${obj.stream}\nendstream\nendobj\n`;
  } else {
    out += `${num} 0 obj\n${obj}\nendobj\n`;
  }
}
const xrefPos = out.length;
out += `xref\n0 ${objects.length + 1}\n`;
out += '0000000000 65535 f \n';
for (let i = 1; i <= objects.length; i++) {
  out += String(offsets[i - 1]).padStart(10, '0') + ' 00000 n \n';
}
out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
process.stdout.write(out);
