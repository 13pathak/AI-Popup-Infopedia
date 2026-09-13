const fs = require('fs');
const buf = fs.readFileSync(process.argv[2] || 'test_highlight.pdf');
const s = buf.toString('latin1');
const m = s.match(/xref\n0 (\d+)\n([\s\S]*?)startxref\n(\d+)/);
if (!m) { console.log('NO XREF'); process.exit(1); }
const count = +m[1];
const rows = m[2].trim().split('\n');
let ok = true;
for (let i = 1; i < count; i++) {
  const off = parseInt(rows[i].slice(0, 10), 10);
  const expect = `${i} 0 obj`;
  const got = s.slice(off, off + 8).trim();
  if (got !== expect) { ok = false; console.log('BAD', i, JSON.stringify(got), 'expected', expect); }
}
const startxref = +m[3];
console.log(s.slice(startxref, startxref + 4) === 'xref' ? 'STARTXREF OK' : 'STARTXREF BAD');
console.log(ok ? 'XREF OK' : 'XREF BROKEN');
