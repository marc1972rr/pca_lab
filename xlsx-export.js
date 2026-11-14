/* PCA Lab · Gerador XLSX mínimo, sem dependência externa e compatível com uso offline. */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = bytes => {
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const colName = n => {
    let out = '';
    while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
    return out;
  };
  function sheetXml(rows) {
    const normalized = Array.isArray(rows) ? rows : [];
    const maxCols = Math.max(1, ...normalized.map(row => Array.isArray(row) ? row.length : 1));
    const maxRows = Math.max(1, normalized.length);
    const colDefs = Array.from({length:maxCols}, (_,i) => {
      const heading=String(normalized[0]?.[i]??'').toLocaleLowerCase('pt-BR');
      const width=/descri[cç][ãa]o|justificativa|trecho|linha original|planos considerados|detalhe/.test(heading)?46:/arquivo|departamento|unidade gestora/.test(heading)?30:/valor|quantidade|p[aá]gina|exerc[ií]cio|prioridade|data/.test(heading)?18:(i===0?25:20);
      return `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`;
    }).join('');
    const body = normalized.map((row, ri) => {
      const cells = Array.from({length:maxCols}, (_,ci) => {
        const value = Array.isArray(row) ? row[ci] : (ci === 0 ? row : '');
        if (value === null || value === undefined || value === '') return '';
        const ref = `${colName(ci+1)}${ri+1}`;
        if (ri > 0 && value && typeof value === 'object' && typeof value.formula === 'string') {
          const cached = Number(value.value);
          return `<c r="${ref}" s="2"><f>${xml(value.formula)}</f><v>${Number.isFinite(cached)?cached:0}</v></c>`;
        }
        if (ri > 0 && typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}" s="2"><v>${value}</v></c>`;
        }
        if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
        return `<c r="${ref}" t="inlineStr" s="${ri === 0 ? 1 : 3}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${ri+1}">${cells}</row>`;
    }).join('');
    const lastCell = `${colName(maxCols)}${maxRows}`;
    const autoFilter = normalized.length > 1 ? `<autoFilter ref="A1:${lastCell}"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`+
      `<dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`+
      `<cols>${colDefs}</cols><sheetData>${body}</sheetData>${autoFilter}</worksheet>`;
  }
  function zipStore(files) {
    const localParts = [], centralParts = [];
    let offset = 0;
    const dosTime = 0, dosDate = ((2026-1980) << 9) | (1 << 5) | 1;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x0800,true);
      lv.setUint16(8,0,true); lv.setUint16(10,dosTime,true); lv.setUint16(12,dosDate,true);
      lv.setUint32(14,crc,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true);
      lv.setUint16(26,name.length,true); lv.setUint16(28,0,true);
      local.set(name,30); local.set(data,30+name.length); localParts.push(local);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
      cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true); cv.setUint16(12,dosTime,true); cv.setUint16(14,dosDate,true);
      cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
      cv.setUint16(28,name.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true);
      cv.setUint16(34,0,true); cv.setUint16(36,0,true); cv.setUint32(38,0,true); cv.setUint32(42,offset,true);
      central.set(name,46); centralParts.push(central);
      offset += local.length;
    }
    const centralSize = centralParts.reduce((s,p)=>s+p.length,0);
    const end = new Uint8Array(22); const ev = new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true);
    ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
    ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true); ev.setUint16(20,0,true);
    const total = offset + centralSize + end.length;
    const out = new Uint8Array(total); let cursor = 0;
    for (const part of localParts) { out.set(part,cursor); cursor += part.length; }
    for (const part of centralParts) { out.set(part,cursor); cursor += part.length; }
    out.set(end,cursor);
    return out;
  }
  function buildXlsx(sheets) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error('Não há planilhas para exportar.');
    const safeSheets = sheets.slice(0,25).map((s,i)=>({
      name:String(s.name || `Planilha ${i+1}`).replace(/[\\/?*\[\]:]/g,' ').slice(0,31) || `Planilha ${i+1}`,
      rows:Array.isArray(s.rows)?s.rows:[]
    }));
    const seen = new Set();
    safeSheets.forEach(s=>{let base=s.name,n=2;while(seen.has(s.name)){s.name=`${base.slice(0,26)} (${n++})`.slice(0,31);}seen.add(s.name);});
    const workbookSheets = safeSheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
    const rels = safeSheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('') +
      `<Relationship Id="rId${safeSheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    const contentOverrides = safeSheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const files = [
      {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${contentOverrides}</Types>`},
      {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PCA Lab — Plano de Contratações</dc:title><dc:creator>PCA Lab</dc:creator></cp:coreProperties>`},
      {name:'docProps/app.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PCA Lab</Application></Properties>`},
      {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="9000"/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`},
      {name:'xl/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172B4D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE3E8F0"/></left><right style="thin"><color rgb="FFE3E8F0"/></right><top style="thin"><color rgb="FFE3E8F0"/></top><bottom style="thin"><color rgb="FFE3E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
      ...safeSheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}))
    ];
    return zipStore(files);
  }
  function download(sheets, filename='pca-lab-consolidado.xlsx') {
    const bytes = buildXlsx(sheets);
    const blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  window.PCAExcel = { buildXlsx, download };
})();
