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
  let branding = { organization: 'GOVERNO DO ESTADO DO ACRE', logoDataUrl: null };
  function configureBranding(options) { branding = Object.assign({}, branding, options || {}); }
  function imageBytes(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return null;
    try {
      const binary = atob(match[2].replace(/\s/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const png = match[1].toLowerCase() === 'png';
      return { bytes: bytes, extension: png ? 'png' : 'jpg', contentType: png ? 'image/png' : 'image/jpeg' };
    } catch (error) {
      console.warn('PCA Lab: não foi possível incorporar o brasão ao Excel.', error);
      return null;
    }
  }
  function inferHeader(sheets, options) {
    const main = sheets.find(s => /pca consolidado/i.test(s.name)) || sheets[0];
    const rows = main && main.rows ? main.rows : [];
    const heads = Array.isArray(rows[0]) ? rows[0].map(v => String(v || '').toLocaleLowerCase('pt-BR')) : [];
    const find = re => heads.findIndex(h => re.test(h));
    const unique = index => index < 0 ? [] : Array.from(new Set(rows.slice(1).map(r => String((r || [])[index] == null ? '' : r[index]).trim()).filter(Boolean)));
    const units = unique(find(/unidade gestora/));
    const depts = unique(find(/departamento requisitante|departamento/));
    const years = unique(find(/exerc[ií]cio/));
    let unit = 'RELATÓRIO DE PLANEJAMENTO DAS CONTRATAÇÕES';
    if (depts.length === 1) unit = depts[0];
    else if (depts.length > 1) unit = 'CONSOLIDAÇÃO DE ' + depts.length + ' DEPARTAMENTOS';
    else if (units.length === 1) unit = 'UNIDADE GESTORA: ' + units[0];
    else if (units.length > 1) unit = 'CONSOLIDAÇÃO DE ' + units.length + ' UNIDADES GESTORAS';
    const year = years.length === 1 ? years[0] : (years.length > 1 ? 'EXERCÍCIOS ' + years.join(' / ') : '');
    return {
      organization: (options && options.organization) || branding.organization,
      unitLabel: (options && options.unitLabel) || unit,
      planTitle: (options && options.planTitle) || ('PLANO ANUAL DE CONTRATAÇÃO' + (year ? ' ' + year : '')),
      emittedAt: (options && options.emittedAt) || new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
    };
  }
  function styleFor(value, heading, alternate) {
    const h = String(heading || '').toLocaleLowerCase('pt-BR');
    if (/valor|orçamento|orcamento|preço|preco|limite/.test(h)) return alternate ? 6 : 3;
    if (/quantidade|qtd\.?|página|pagina|itens$/.test(h) && typeof value === 'number') return alternate ? 7 : 4;
    return alternate ? 5 : 2;
  }
  function sheetXml(sheet, header, hasLogo) {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const dataCols = Math.max(1, ...rows.map(row => Array.isArray(row) ? row.length : 1));
    const layoutCols = Math.max(8, dataCols);
    const lastCol = colName(layoutCols);
    const dataLastCol = colName(dataCols);
    const tableRow = 7;
    const finalRow = Math.max(tableRow, rows.length + 6);
    const widths = [];
    let cols = '';
    for (let i = 0; i < layoutCols; i++) {
      const heading = String((rows[0] || [])[i] || '').toLocaleLowerCase('pt-BR');
      const width = /descri[cç][ãa]o|justificativa|trecho|linha original|detalhe|objeto|observa[cç][ãa]o|apontamento/.test(heading) ? 42 :
        /arquivo|departamento|unidade gestora|fonte de recurso/.test(heading) ? 28 :
        /valor|quantidade|p[aá]gina|exerc[ií]cio|prioridade|data|processo|categoria/.test(heading) ? 17 : (i === 0 ? 22 : 18);
      widths.push(width);
      cols += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
    }
    const makeCells = (row, rowNumber, rowIndex) => {
      const values = Array.isArray(row) ? row : [row];
      return values.map((value, ci) => {
        if (value === null || value === undefined || value === '') return '';
        const ref = colName(ci + 1) + rowNumber;
        const heading = (rows[0] || [])[ci] || '';
        const alternate = rowIndex > 0 && rowIndex % 2 === 0;
        const style = rowIndex === 0 ? 1 : styleFor(value, heading, alternate);
        if (rowIndex > 0 && value && typeof value === 'object' && typeof value.formula === 'string') {
          const formula = value.formula.replace(/([A-Z]{1,3})(\d+)/g, (_, col, r) => col + (Number(r) + 6));
          const cached = Number(value.value);
          return '<c r="' + ref + '" s="' + style + '"><f>' + xml(formula) + '</f><v>' + (Number.isFinite(cached) ? cached : 0) + '</v></c>';
        }
        if (rowIndex > 0 && typeof value === 'number' && Number.isFinite(value)) return '<c r="' + ref + '" s="' + style + '"><v>' + value + '</v></c>';
        if (typeof value === 'boolean') return '<c r="' + ref + '" t="b" s="' + style + '"><v>' + (value ? 1 : 0) + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
      }).join('');
    };
    const titles = [
      [2, header.organization, 8, 27],
      [3, header.unitLabel, 9, 22],
      [4, header.planTitle, 10, 20],
      [5, sheet.name.toLocaleUpperCase('pt-BR') + '  •  EMITIDO EM ' + header.emittedAt, 10, 18]
    ].map(x => '<row r="' + x[0] + '" ht="' + x[3] + '" customHeight="1"><c r="A' + x[0] + '" t="inlineStr" s="' + x[2] + '"><is><t>' + xml(x[1]) + '</t></is></c></row>').join('');
    const tableRows = rows.map((row, index) => {
      const target = index + tableRow;
      const cells = makeCells(row, target, index);
      let maxLines = 1;
      (Array.isArray(row) ? row : [row]).forEach((value, ci) => {
        const str = value && typeof value === 'object' && value.formula ? String(value.value || '') : String(value == null ? '' : value);
        maxLines = Math.max(maxLines, Math.ceil(str.length / Math.max(12, Math.floor(widths[ci] * 1.2))));
      });
      const height = index === 0 ? 34 : Math.min(84, Math.max(22, 8 + maxLines * 14));
      return '<row r="' + target + '" ht="' + height + '" customHeight="1">' + cells + '</row>';
    }).join('');
    const merges = '<mergeCells count="4"><mergeCell ref="A2:' + lastCol + '2"/><mergeCell ref="A3:' + lastCol + '3"/><mergeCell ref="A4:' + lastCol + '4"/><mergeCell ref="A5:' + lastCol + '5"/></mergeCells>';
    const filter = rows.length > 1 ? '<autoFilter ref="A' + tableRow + ':' + dataLastCol + finalRow + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><dimension ref="A1:' + lastCol + finalRow + '"/>' +
      '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="18"/><cols>' + cols + '</cols><sheetData><row r="1" ht="62" customHeight="1"/>' + titles + '<row r="6" ht="8" customHeight="1"/>' + tableRows + '</sheetData>' +
      merges + filter + (hasLogo ? '<drawing r:id="rId1"/>' : '') + '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
      '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>' +
      '<headerFooter><oddFooter>&amp;L PCA LAB&amp;R Página &amp;P de &amp;N</oddFooter></headerFooter></worksheet>';
  }
  function drawingXml(anchorCol) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<xdr:oneCellAnchor><xdr:from><xdr:col>' + Math.max(0, anchorCol) + '</xdr:col><xdr:colOff>65000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>45000</xdr:rowOff></xdr:from><xdr:ext cx="610000" cy="550000"/>' +
      '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Brasão do Estado do Acre"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
      '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
      '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="610000" cy="550000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
  }
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.###"/></numFmts>' +
      '<fonts count="5"><font><sz val="10"/><name val="Aptos"/><color rgb="FF202B33"/></font><font><b/><sz val="9"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="15"/><name val="Aptos Display"/><color rgb="FF087A3C"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF126B3A"/></font><font><sz val="9"/><name val="Aptos"/><color rgb="FF667085"/></font></fonts>' +
      '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF079B4F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF5EE"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD8DEE4"/></left><right style="thin"><color rgb="FFD8DEE4"/></right><top style="thin"><color rgb="FFD8DEE4"/></top><bottom style="thin"><color rgb="FFD8DEE4"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
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
  function buildXlsx(sheets, options = {}) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error('Não há planilhas para exportar.');
    const safeSheets = sheets.slice(0, 25).map((s, i) => ({
      name: String(s.name || ('Planilha ' + (i + 1))).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || ('Planilha ' + (i + 1)),
      rows: Array.isArray(s.rows) ? s.rows : []
    }));
    const seen = new Set();
    safeSheets.forEach(s => { const base = s.name; let n = 2; while (seen.has(s.name)) s.name = base.slice(0, 26) + ' (' + (n++) + ')'; seen.add(s.name); });
    const header = inferHeader(safeSheets, options);
    // brasao.js é carregado depois do exportador; o brasão é lido no clique de exportar e embutido no XLSX.
    const crest = options.logoDataUrl || branding.logoDataUrl || (window.BRASAO_B64 ? 'data:image/png;base64,' + window.BRASAO_B64 : null);
    const logo = imageBytes(crest);
    const ext = logo ? logo.extension : 'png';
    const mime = logo ? logo.contentType : 'image/png';
    const sheetNodes = safeSheets.map((s, i) => '<sheet name="' + xml(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('');
    const relNodes = safeSheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (safeSheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    const sheetOverrides = safeSheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('');
    const drawingOverrides = logo ? safeSheets.map((s, i) => '<Override PartName="/xl/drawings/drawing' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>').join('') : '';
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        (logo ? '<Default Extension="' + ext + '" ContentType="' + mime + '"/>' : '') +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + sheetOverrides + drawingOverrides + '</Types>'
      },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
      },
      { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PCA Lab — Plano de Contratações</dc:title><dc:creator>PCA Lab</dc:creator></cp:coreProperties>'
      },
      { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PCA Lab</Application></Properties>'
      },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="9000"/></bookViews><sheets>' + sheetNodes + '</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'
      },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relNodes + '</Relationships>'
      },
      { name: 'xl/styles.xml', data: stylesXml() },
      ...safeSheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s, header, Boolean(logo)) })),
      ...(logo ? safeSheets.flatMap((s, i) => [
        { name: 'xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + (i + 1) + '.xml"/></Relationships>'
        },
        { name: 'xl/drawings/drawing' + (i + 1) + '.xml', data: drawingXml(Math.max(0, Math.floor(Math.max(8, (s.rows[0] || []).length) / 2) - 1)) },
        { name: 'xl/drawings/_rels/drawing' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/brasao-acre.' + ext + '"/></Relationships>'
        }
      ]) : []),
      ...(logo ? [{ name: 'xl/media/brasao-acre.' + ext, data: logo.bytes }] : [])
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
  window.PCAExcel = { buildXlsx, download, configureBranding };
})();
