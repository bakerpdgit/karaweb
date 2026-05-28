// Exports the submission grid as a real .xlsx workbook.
//
// Excel will warn "the file format and extension don't match" if you
// give it an HTML table renamed .xls, so we build a minimal valid
// OOXML SpreadsheetML package by hand — a ZIP (no compression) of:
//
//   [Content_Types].xml
//   _rels/.rels
//   xl/workbook.xml
//   xl/_rels/workbook.xml.rels
//   xl/styles.xml
//   xl/worksheets/sheet1.xml
//
// Cell encoding:
//   first    → "Y" + green   fill (passed first attempt)
//   eventual → "Y" + amber   fill (passed eventually, not first try)
//   fail     → "N" + red     fill (only failing attempts so far)
//   empty    → ""  + no fill (no submission)

// ── Style indexes (must match the cellXfs order in STYLES_XML below) ──
const STYLE_HEADER   = 1;
const STYLE_FIRST    = 2;
const STYLE_EVENTUAL = 3;
const STYLE_FAIL     = 4;
const STYLE_PLAIN    = 5;

// ── XML helpers ──────────────────────────────────────────────────────
function xmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 0 → A, 25 → Z, 26 → AA, 27 → AB, ...
function colRef(n) {
  let s = '';
  let m = n + 1;
  while (m > 0) {
    const r = (m - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    m = Math.floor((m - 1) / 26);
  }
  return s;
}

// ── Static OOXML parts ───────────────────────────────────────────────
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Submissions" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// 6 fills (indexes 0..5), 2 fonts (regular + bold), bordered + plain
// border indexes, and 6 cellXfs indexes — see STYLE_* constants above.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="6">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF86EFAC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDE68A"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFECACA"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="FF999999"/></left>
<right style="thin"><color rgb="FF999999"/></right>
<top style="thin"><color rgb="FF999999"/></top>
<bottom style="thin"><color rgb="FF999999"/></bottom>
<diagonal/>
</border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Build sheet1.xml from header row + body rows. Each `cells[r][c]` is
// `{ value: string, style: number }`; missing cells render as empty.
function buildSheetXml(rows) {
  const out = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetData>',
  ];
  for (let r = 0; r < rows.length; r++) {
    out.push(`<row r="${r + 1}">`);
    const cells = rows[r];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      if (!cell) continue;
      const ref = `${colRef(c)}${r + 1}`;
      const s = cell.style ?? 0;
      const v = cell.value ?? '';
      if (v === '') {
        // Empty cell still gets its style (so the border + fill render).
        out.push(`<c r="${ref}" s="${s}"/>`);
      } else {
        out.push(`<c r="${ref}" s="${s}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`);
      }
    }
    out.push('</row>');
  }
  out.push('</sheetData></worksheet>');
  return out.join('');
}

// ── ZIP builder (STORED method, no compression) ──────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const lfh = new ArrayBuffer(30);
    const lv = new DataView(lfh);
    lv.setUint32(0,  0x04034b50, true);
    lv.setUint16(4,  20,         true);   // version needed
    lv.setUint16(6,  0,          true);   // flags
    lv.setUint16(8,  0,          true);   // method = stored
    lv.setUint16(10, 0,          true);   // mod time
    lv.setUint16(12, 0,          true);   // mod date
    lv.setUint32(14, crc,        true);
    lv.setUint32(18, size,       true);
    lv.setUint32(22, size,       true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0,          true);   // extra len
    parts.push(new Uint8Array(lfh), nameBytes, data);

    const cdh = new ArrayBuffer(46);
    const cv = new DataView(cdh);
    cv.setUint32(0,  0x02014b50, true);
    cv.setUint16(4,  20,         true);   // version made by
    cv.setUint16(6,  20,         true);   // version needed
    cv.setUint16(8,  0,          true);
    cv.setUint16(10, 0,          true);
    cv.setUint16(12, 0,          true);
    cv.setUint16(14, 0,          true);
    cv.setUint32(16, crc,        true);
    cv.setUint32(20, size,       true);
    cv.setUint32(24, size,       true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0,          true);
    cv.setUint16(32, 0,          true);
    cv.setUint16(34, 0,          true);
    cv.setUint16(36, 0,          true);
    cv.setUint32(38, 0,          true);
    cv.setUint32(42, offset,     true);
    centrals.push(new Uint8Array(cdh), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  let cdSize = 0;
  for (const c of centrals) cdSize += c.length;
  const cdStart = offset;

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0,  0x06054b50, true);
  ev.setUint16(4,  0,          true);
  ev.setUint16(6,  0,          true);
  ev.setUint16(8,  files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize,     true);
  ev.setUint32(16, cdStart,    true);
  ev.setUint16(20, 0,          true);

  const total = cdStart + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts)    { out.set(p, pos); pos += p.length; }
  for (const c of centrals) { out.set(c, pos); pos += c.length; }
  out.set(new Uint8Array(eocd), pos);
  return out;
}

// ── Public API ───────────────────────────────────────────────────────
export function exportSubmissionsAsXls({ students, challenges, cells, classMaskCode, filename }) {
  const rows = [];

  // Header row.
  const headerRow = [{ value: 'Username / code', style: STYLE_HEADER }];
  for (const ch of challenges) {
    headerRow.push({ value: ch.name, style: STYLE_HEADER });
  }
  rows.push(headerRow);

  // Body rows.
  for (const s of students) {
    const r = [{ value: s.username, style: STYLE_PLAIN }];
    for (const ch of challenges) {
      const cell = cells?.[s.code]?.[ch.guid || ch.id];
      if (!cell) {
        r.push({ value: '', style: STYLE_PLAIN });
      } else if (cell.status === 'first') {
        r.push({ value: 'Y', style: STYLE_FIRST });
      } else if (cell.status === 'eventual') {
        r.push({ value: 'Y', style: STYLE_EVENTUAL });
      } else {
        r.push({ value: 'N', style: STYLE_FAIL });
      }
    }
    rows.push(r);
  }

  const enc = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml',          data: enc.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels',                  data: enc.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml',              data: enc.encode(WORKBOOK_XML) },
    { name: 'xl/_rels/workbook.xml.rels',   data: enc.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/styles.xml',                data: enc.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml',     data: enc.encode(buildSheetXml(rows)) },
  ];
  const zipBytes = buildZip(files);

  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `karaweb-submissions${classMaskCode ? '-' + classMaskCode : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
