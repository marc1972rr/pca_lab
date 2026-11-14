/* PCA Lab — protótipo estático. Extração heurística: toda informação exige revisão humana. */
(() => {
  'use strict';

  const APP_VERSION = '0.3.0';
  const SCHEMA = 'pca-lab-workspace/v2';
  const DB_NAME = 'pca-lab-local';
  const STORE_NAME = 'workspace';
  const FALLBACK_KEY = 'pca-lab-workspace-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let workspace = { schema: SCHEMA, appVersion: APP_VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), documents: [] };
  let selectedDocId = null;
  let activeView = 'overview';
  let activeDetailTab = 'structured';
  let db = null;
  let saveTimer = null;
  let isLoading = false;

  const FIELD_DEFS = [
    { key: 'exercicio', label: 'Exercício de referência', placeholder: 'Ex.: 2027', width: 1 },
    { key: 'unidadeGestora', label: 'Unidade gestora', placeholder: 'Nome ou código da UG', width: 1 },
    { key: 'departamento', label: 'Departamento requisitante', placeholder: 'Unidade ou setor', width: 1 },
    { key: 'responsavel', label: 'Responsável pela demanda', placeholder: 'Nome / cargo', width: 1 },
    { key: 'numeroProcesso', label: 'Processo / identificador', placeholder: 'Número do processo', width: 1 },
    { key: 'tipoContratacao', label: 'Natureza / tipo', type: 'select', options: ['', 'Material', 'Serviço', 'Obra / engenharia', 'Tecnologia da informação', 'Solução integrada', 'Não identificado'], width: 1 },
    { key: 'objeto', label: 'Objeto resumido', type: 'textarea', width: 3 },
    { key: 'justificativa', label: 'Justificativa / necessidade', type: 'textarea', width: 3 },
    { key: 'prioridade', label: 'Prioridade', type: 'select', options: ['', 'Alta', 'Média', 'Baixa', 'Não informada'], width: 1 },
    { key: 'dataDesejada', label: 'Data desejada / prevista', placeholder: 'AAAA-MM-DD ou mês/ano', width: 1 },
    { key: 'valorGlobal', label: 'Valor global estimado (R$)', placeholder: '0,00', width: 1 },
  ];

  const UNIT_WORDS = [
    'unidade', 'unid.', 'unid', 'und.', 'und', 'peça', 'peca', 'caixa', 'cx.', 'cx', 'pacote', 'pct.', 'pct', 'resma',
    'recarga', 'garrafão', 'garrafao', 'frasco', 'litro', 'litros', 'kg', 'quilo', 'quilograma', 'grama', 'g', 'metro', 'm²', 'm2',
    'metro linear', 'rolo', 'par', 'jogo', 'kit', 'serviço', 'servico', 'mês', 'mes', 'mensalidade', 'diária', 'diaria', 'hora', 'horas',
    'licença', 'licenca', 'assinatura', 'posto', 'viagem', 'passagem', 'tonelada', 'lata', 'saco', 'galão', 'galao'
  ];
  const UNIT_REGEX = UNIT_WORDS.slice().sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|');

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function uid(prefix='id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function formatDate(value) {
    if (!value) return 'Data não informada';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
  }
  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = typeof value === 'number' ? value : parseBrazilianNumber(value);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : String(value);
  }
  function parseBrazilianNumber(value) {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return NaN;
    let s = String(value).trim().replace(/R\$/gi,'').replace(/\s/g,'');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');
    else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g,'');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function toDisplayNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    const n = typeof value === 'number' ? value : parseBrazilianNumber(value);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : String(value);
  }
  function toast(message, type='') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('#toast-region').append(node);
    setTimeout(() => node.remove(), 3800);
  }
  function setSaveStatus(text, type='ok') {
    const el = $('#save-indicator');
    if (!el) return;
    el.innerHTML = `<i></i> ${escapeHtml(text)}`;
    el.classList.toggle('save-error', type === 'error');
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local'));
    });
  }
  async function loadWorkspace() {
    try {
      db = await openDatabase();
      const stored = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('current');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (stored && Array.isArray(stored.documents)) workspace = validateImportedState(stored);
      else {
        const fallback = localStorage.getItem(FALLBACK_KEY);
        if (fallback) workspace = validateImportedState(JSON.parse(fallback));
      }
      setSaveStatus('Salvo neste navegador');
      document.dispatchEvent(new CustomEvent('pca:workspace-updated'));
    } catch (err) {
      try {
        const fallback = localStorage.getItem(FALLBACK_KEY);
        if (fallback) workspace = validateImportedState(JSON.parse(fallback));
        setSaveStatus('Armazenamento básico ativo');
      } catch (_) {
        setSaveStatus('Armazenamento indisponível', 'error');
      }
    }
    renderAll();
    document.dispatchEvent(new CustomEvent('pca:workspace-updated'));
  }
  function scheduleSave() {
    if (isLoading) return;
    setSaveStatus('Salvando...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorkspace, 250);
  }
  async function saveWorkspace() {
    workspace.updatedAt = new Date().toISOString();
    try {
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(workspace, 'current');
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Gravação cancelada'));
        });
      } else {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(workspace));
      }
      setSaveStatus('Salvo neste navegador');
      document.dispatchEvent(new CustomEvent('pca:workspace-updated'));
    } catch (err) {
      try {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(workspace));
        setSaveStatus('Salvo (modo básico)');
      } catch (_) {
        setSaveStatus('Falha ao salvar', 'error');
        toast('Não foi possível salvar. Exporte o JSON para evitar perda de dados.', 'error');
      }
    }
  }

  function groupPdfTextItems(items) {
    const lineGroups = [];
    for (const item of items) {
      const value = (item.str || '').trim();
      if (!value) continue;
      const y = item.transform ? item.transform[5] : 0;
      const x = item.transform ? item.transform[4] : 0;
      let group = lineGroups.find(g => Math.abs(g.y - y) <= 2.3);
      if (!group) { group = { y, parts: [] }; lineGroups.push(group); }
      group.parts.push({ x, value, width: item.width || 0 });
    }
    return lineGroups.sort((a,b)=>b.y-a.y).map(g => {
      const parts = g.parts.sort((a,b)=>a.x-b.x);
      let line = '';
      let prev = null;
      for (const p of parts) {
        const gap = prev ? p.x - (prev.x + prev.width) : 0;
        if (line && (gap > 1.5 || !/[-/]$/.test(line))) line += ' ';
        line += p.value;
        prev = p;
      }
      return line.replace(/\s+/g,' ').trim();
    }).filter(Boolean);
  }
  async function extractPdf(file, progressCb) {
    if (!window.pdfjsLib) throw new Error('A biblioteca PDF.js não foi carregada. Verifique a conexão e recarregue a página.');
    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page: n, lines: groupPdfTextItems(content.items) });
      if (progressCb) progressCb(n / pdf.numPages);
    }
    const rawText = pages.map(p => `--- PÁGINA ${p.page} ---\n${p.lines.join('\n')}`).join('\n\n');
    const nonEmpty = pages.reduce((sum,p)=>sum+p.lines.join('').replace(/\s/g,'').length,0);
    return { pages, rawText, pageCount: pdf.numPages, hasText: nonEmpty > 25 };
  }

  function textAfterLabel(lines, patterns) {
    for (let i=0;i<lines.length;i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        const m = line.match(pattern);
        if (m) {
          const result = (m[1] || '').trim().replace(/^[:\-–\s]+/,'');
          if (result && result.length > 2) return result;
          const next = lines[i+1] || '';
          if (next && next.length > 3 && next.length < 300) return next.trim();
        }
      }
    }
    return '';
  }
  function firstMatch(text, regex) { const m = text.match(regex); return m ? (m[1] || m[0]).trim() : ''; }
  function classifyType(text) {
    const s = text.toLocaleLowerCase('pt-BR');
    if (/obra|engenharia|reforma|construção|construcao|projeto executivo/.test(s)) return 'Obra / engenharia';
    if (/software|licença de uso|licenca de uso|sistema de informação|sistema informatizado|infraestrutura de ti|tecnologia da informação/.test(s)) return 'Tecnologia da informação';
    if (/serviço|servico|prestação de serviços|prestacao de servicos|consultoria|manutenção|manutencao|locação|locacao/.test(s)) return 'Serviço';
    if (/aquisição|aquisicao|compra|fornecimento|material|equipamento|insumo/.test(s)) return 'Material';
    return 'Não identificado';
  }
  function extractMetadata(pages, filename) {
    const lines = pages.flatMap(p=>p.lines);
    const full = lines.join('\n');
    const valueGlobalRaw = firstMatch(full, /(?:valor\s+(?:global|total|estimado)(?:\s+da\s+contratação)?|estimativa\s+do\s+valor)[^\n]{0,80}?(?:R\$\s*)?([\d.]+,\d{2}|[\d.]{4,})/i);
    const exercicio = firstMatch(full, /(?:exercício|exercicio|ano de referência|ano-base|ano base)\s*[:\-]?\s*(20\d{2})/i) || firstMatch(filename, /(20\d{2})/);
    const prioridade = firstMatch(full, /prioridade\s*[:\-]?\s*(alta|média|media|baixa)/i);
    const dateMatch = firstMatch(full, /(?:data desejada|data prevista|previsão da contratação|previsao da contratacao|mês pretendido|mes pretendido)\s*[:\-]?\s*([\d/.-]{6,10}|[A-Za-zÀ-ÿ]+\s+de?\s*20\d{2})/i);
    const objeto = textAfterLabel(lines, [/(?:objeto(?:\s+da\s+contratação)?|descrição do objeto|descricao do objeto)\s*[:\-–]\s*(.*)/i]);
    const justificativa = textAfterLabel(lines, [/(?:justificativa(?:\s+da\s+contratação)?|fundamentação da necessidade|fundamentacao da necessidade|descrição da necessidade)\s*[:\-–]\s*(.*)/i]);
    const ug = textAfterLabel(lines, [/(?:unidade gestora|órgão gerenciador|orgao gerenciador|órgão demandante|orgao demandante)\s*[:\-–]\s*(.*)/i]);
    const dept = textAfterLabel(lines, [/(?:departamento requisitante|unidade requisitante|setor requisitante|unidade demandante|setor demandante|departamento)\s*[:\-–]\s*(.*)/i]);
    const responsavel = textAfterLabel(lines, [/(?:responsável pela demanda|responsavel pela demanda|responsável|responsavel|elaborador)\s*[:\-–]\s*(.*)/i]);
    const processo = firstMatch(full, /(?:processo(?:\s+administrativo)?|nº do processo|no do processo)\s*(?:n[ºo.]?\s*)?[:\-]?\s*([\d./-]{5,})/i);
    const allContext = `${filename}\n${full}`;
    return {
      exercicio, unidadeGestora:ug, departamento:dept, responsavel,
      numeroProcesso:processo, tipoContratacao:classifyType(allContext), objeto,
      justificativa, prioridade:prioridade ? prioridade[0].toUpperCase()+prioridade.slice(1).toLowerCase() : '',
      dataDesejada:dateMatch, valorGlobal:valueGlobalRaw ? toDisplayNumber(parseBrazilianNumber(valueGlobalRaw)) : ''
    };
  }
  function parseDemandLines(pages) {
    const out = [];
    const used = new Set();
    const number = '(?:R\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,4})?|(?:R\\$\\s*)?\\d+(?:,\\d{1,4})?';
    const rowRx = new RegExp('^\\s*(?:item\\s*)?(\\d{1,4})[.)]?\\s+(.+?)\\s+(' + UNIT_REGEX + ')\\s+(' + number + ')(?:\\s+(' + number + '))?(?:\\s+(' + number + '))?\\s*$', 'i');
    const startRx = /^\s*(?:item\s*)?(\d{1,4})[.)]?\s+(.+)/i;

    for (const page of pages) {
      const groups = [];
      let current = null;
      for (const line of page.lines) {
        const m = line.match(startRx);
        if (m) {
          if (current) groups.push(current);
          current = { lines: [line], item: m[1] };
        } else if (current && line.trim() && !/^(?:total|subtotal|observa[cç][ãa]o|fonte|assinatura|p[aá]gina)\b/i.test(line.trim())) {
          // Linhas subsequentes são tratadas como continuação da descrição até o próximo número de item.
          current.lines.push(line);
        }
      }
      if (current) groups.push(current);

      // Mantém compatibilidade com tabelas simples sem numeração explícita agrupada.
      for (const group of groups) {
        const combined = group.lines.join(' ').replace(/\s+/g, ' ').trim();
        const m = combined.match(rowRx);
        if (!m) continue;
        const description = m[2].replace(/\s+/g,' ').trim();
        if (description.length < 3 || /descrição|quantidade|valor unitário|valor total/i.test(description)) continue;
        const qty = parseBrazilianNumber(m[4]);
        const unitPrice = m[5] ? parseBrazilianNumber(m[5]) : NaN;
        const totalPrice = m[6] ? parseBrazilianNumber(m[6]) : NaN;
        const sourceLines = group.lines.join('\n');
        const catalogMatch=findCatalogMatch(description);
        const originalUnit=m[3];
        const normalizedUnit=window.PCACatalog?.normalizeUnit(originalUnit)||originalUnit;
        const demand = {
          id: uid('demand'), item: m[1], tipo: '', descricaoOriginal: description,
          descricaoPadronizada: description, categoria: classifyCategory(description),
          unidade: normalizedUnit, unidadeOriginal: originalUnit,
          catalogoId: catalogMatch?.id || '', codigoCatmat: catalogMatch?.codigoCatmat || '',
          sugestaoCatalogo: catalogMatch?.descricaoPadrao || '', catalogoAlias: catalogMatch?.aliasCorrespondente || '',
          quantidade: Number.isFinite(qty) ? toDisplayNumber(qty) : '',
          valorUnitario: Number.isFinite(unitPrice) ? toDisplayNumber(unitPrice) : '',
          valorTotal: Number.isFinite(totalPrice) ? toDisplayNumber(totalPrice) : '',
          valorTotalOriginal: Number.isFinite(totalPrice) ? toDisplayNumber(totalPrice) : '',
          valorTotalModo: Number.isFinite(totalPrice) ? 'documento' : 'calculado',
          pagina: page.page, linhaOriginal: sourceLines, status: 'revisar', observacoes: [],
          provenance: Object.fromEntries(['item','descricaoOriginal','descricaoPadronizada','unidade','quantidade','valorUnitario','valorTotal'].map(key=>[key,{method:'extração PDF',page:page.page,sourceText:sourceLines,reviewed:false,confidence:null}]))
        };
        recalculateDemand(demand, { initialize: true });
        out.push(demand);
        for (const sourceLine of group.lines) used.add(`${page.page}::${sourceLine}`);
      }
    }
    return { demands: out, used };
  }

  function findCatalogMatch(description) {
    try { return window.PCACatalog?.find(description) || null; }
    catch (_) { return null; }
  }
  function classifyCategory(description) {
    const catalogMatch=findCatalogMatch(description);
    if(catalogMatch?.categoria) return catalogMatch.categoria;
    const s = description.toLocaleLowerCase('pt-BR');
    const catalog = [
      { category: 'Material de expediente', words: ['papel a4','papel sulfite','caneta','lapis','lápis','grampeador','pasta','envelope','expediente','escritorio','escritório'] },
      { category: 'Tecnologia da informação', words: ['computador','notebook','monitor','software','licenca','licença','impressora','rede','servidor','tecnologia'] },
      { category: 'Material de limpeza/higiene', words: ['limpeza','higiene','detergente','desinfetante','sabonete','papel toalha'] },
      { category: 'Combustíveis e lubrificantes', words: ['combustivel','combustível','gasolina','diesel','lubrificante'] },
      { category: 'Veículos e manutenção', words: ['veiculo','veículo','automovel','automóvel','pneu','peca automotiva','peça automotiva'] },
      { category: 'Obras e engenharia', words: ['obra','reforma','engenharia','construcao','construção'] },
      { category: 'Serviços', words: ['servico','serviço','manutencao','manutenção','consultoria','locacao','locação'] }
    ];
    const normalized = normalizeComparable(s);
    const match = catalog.find(entry => entry.words.some(word => normalized.includes(normalizeComparable(word))));
    return match?.category || 'Não classificado';
  }

  function recalculateDemand(demand, options = {}) {
    const quantity = parseBrazilianNumber(demand.quantidade);
    const unitPrice = parseBrazilianNumber(demand.valorUnitario);
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
      const calculated = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
      demand.valorTotalCalculado = toDisplayNumber(calculated);
      demand.calculo = { formula: 'quantidade × valorUnitario', valor: calculated, atualizadoEm: new Date().toISOString() };
      if (!demand.valorTotal || options.fromQuantityOrPrice && demand.valorTotalModo !== 'manual') {
        if (demand.valorTotal && !demand.valorTotalOriginal) demand.valorTotalOriginal = demand.valorTotal;
        demand.valorTotal = toDisplayNumber(calculated);
        demand.valorTotalModo = 'calculado';
        demand.provenance=demand.provenance||{};
        const previous=demand.provenance.valorTotal||{};
        demand.provenance.valorTotal={...previous,method:'cálculo automático',formula:'quantidade × valor unitário',currentValue:demand.valorTotal,reviewed:true,updatedAt:new Date().toISOString()};
      }
    } else {
      demand.valorTotalCalculado = '';
      demand.calculo = { formula: 'quantidade × valorUnitario', valor: null, atualizadoEm: new Date().toISOString() };
      // Evita manter um total antigo que havia sido calculado automaticamente quando a quantidade/preço é apagado.
      // Valores transcritos do documento ou digitados manualmente permanecem preservados.
      if (options.fromQuantityOrPrice && demand.valorTotalModo === 'calculado') demand.valorTotal = '';
    }
    return demand;
  }

  function buildUnmapped(pages, used, metadata, demands) {
    const knownHints = /^(?:plano de contrata|plano anual|plano de contratação anual|estudo técnico preliminar|estudo tecnico preliminar|termo de referência|termo de referencia|processo administrativo|secretaria|órgão|orgao|unidade gestora|departamento|unidade requisitante|objeto|justificativa|valor estimado|exercício|exercicio|prioridade|responsável|responsavel|elaborador|item|descrição|descricao|quantidade|unidade|valor unitário|valor total|cronograma|data desejada|data prevista|assinatura|página|pagina|--- página)/i;
    const mappedValues = Object.values(metadata).filter(Boolean).map(s=>String(s).toLocaleLowerCase('pt-BR'));
    const itemsByPage = new Map();
    for (const d of demands) {
      const key = `${d.pagina}::${d.linhaOriginal}`;
      itemsByPage.set(key,true);
    }
    const extras = [];
    for (const page of pages) {
      for (const line of page.lines) {
        const key = `${page.page}::${line}`;
        if (used.has(key) || itemsByPage.has(key)) continue;
        if (line.length < 5) continue;
        if (/^(?:--- PÁGINA|página \d+|page \d+|item\s+descri[cç][ãa]o\s+unidade|descri[cç][ãa]o\s+do\s+item\s+unidade)$/i.test(line.trim())) continue;
        const norm = line.toLocaleLowerCase('pt-BR');
        if (mappedValues.some(v => v.length > 8 && (norm === v || norm.includes(v)))) continue;
        extras.push({ id:uid('extra'), pagina:page.page, texto:line, status:'nao_classificado', revisado:false });
      }
    }
    return extras;
  }
  function buildIssues(doc) {
    const issues = [];
    const f = doc.normalized || {};
    if (!f.departamento) issues.push({severity:'warning',code:'missing_department',title:'Departamento requisitante não identificado',detail:'Confirme a unidade de origem do plano e preencha o campo correspondente.'});
    if (!f.exercicio) issues.push({severity:'warning',code:'missing_year',title:'Exercício de referência não identificado',detail:'Informe o ano a que o planejamento se refere.'});
    if (!f.objeto) issues.push({severity:'warning',code:'missing_object',title:'Objeto resumido não identificado',detail:'Descreva, de forma sintética, o conjunto de contratações do plano.'});
    if (!f.justificativa) issues.push({severity:'warning',code:'missing_justification',title:'Justificativa não identificada',detail:'Inclua a necessidade ou confirme onde ela está documentada.'});
    if (!f.prioridade || f.prioridade === 'Não informada') issues.push({severity:'warning',code:'missing_priority',title:'Prioridade não informada',detail:'Defina uma prioridade com base em critérios institucionais.'});
    if (!doc.demands.length) issues.push({severity:'warning',code:'no_items',title:'Nenhuma linha de item reconhecida automaticamente',detail:'O documento pode ser um plano narrativo, uma tabela complexa ou um PDF digitalizado. Revise o texto bruto e cadastre itens manualmente.'});
    doc.demands.forEach(d => {
      if (!d.descricaoPadronizada) issues.push({severity:'error',code:'item_without_description',title:`Item ${d.item || ''}: descrição vazia`,detail:'A demanda precisa de uma descrição mínima para ser analisada.'});
      if (!d.unidade) issues.push({severity:'warning',code:'item_without_unit',title:`Item ${d.item || ''}: unidade não identificada`,detail:'Confirme a unidade de fornecimento ou medida.'});
      if (!d.quantidade) issues.push({severity:'warning',code:'item_without_quantity',title:`Item ${d.item || ''}: quantidade não identificada`,detail:'Informe a quantidade e registre a memória de cálculo.'});
      const q = parseBrazilianNumber(d.quantidade), u = parseBrazilianNumber(d.valorUnitario), t = parseBrazilianNumber(d.valorTotal);
      if (Number.isFinite(q) && Number.isFinite(u) && Number.isFinite(t) && Math.abs(q*u-t) > 0.02) issues.push({severity:'warning',code:'math_mismatch',title:`Item ${d.item || ''}: valor total divergente`,detail:`Quantidade × valor unitário resulta em ${formatMoney(q*u)}. O valor total atual é ${formatMoney(t)}. Confira o dado de origem antes de aplicar o cálculo.`});
    });
    if (doc.normalized?.valorGlobal) {
      const declared = parseBrazilianNumber(doc.normalized.valorGlobal);
      const sum = (doc.demands || []).reduce((acc, d) => acc + (Number.isFinite(parseBrazilianNumber(d.valorTotal)) ? parseBrazilianNumber(d.valorTotal) : 0), 0);
      if (Number.isFinite(declared) && sum > 0 && Math.abs(declared - sum) > 0.02) issues.push({severity:'warning',code:'global_total_mismatch',title:'Valor global diverge da soma dos itens',detail:`Valor informado no cabeçalho: ${formatMoney(declared)}. Soma dos itens: ${formatMoney(sum)}.`});
    }
    if (!doc.hasText) issues.push({severity:'error',code:'image_pdf',title:'PDF sem camada textual detectável',detail:'Este arquivo pode ser digitalizado como imagem. Use a ação de OCR quando disponível ou revise o documento manualmente.'});
    return issues;
  }
  function recordActivity(doc, message) {
    doc.activity = doc.activity || [];
    doc.activity.unshift({id:uid('activity'),message,at:new Date().toISOString()});
    if (doc.activity.length > 40) doc.activity.length = 40;
  }
  async function normalizeNewDocument(file, extraction) {
    const metadata = extractMetadata(extraction.pages, file.name);
    const parsed = parseDemandLines(extraction.pages);
    let originalPdfDataUrl = null;
    if (file.size <= 15000000) {
      try { originalPdfDataUrl = await fileToDataUrl(file); }
      catch (error) { console.warn('PDF original não pôde ser preservado; a extração textual foi mantida.', error); }
    }
    const doc = {
      id:uid('doc'), filename:file.name, fileSize:file.size, importedAt:new Date().toISOString(),
      pageCount:extraction.pageCount, hasText:extraction.hasText, extractionMethod:'pdf.js/text-layer',
      rawText:extraction.rawText, rawPages:extraction.pages, normalized:metadata,
      demands:parsed.demands, extraFields:[], unmapped:[], activity:[], issues:[],
      source:{mimeType:file.type || 'application/pdf',lastModified:file.lastModified || null, originalPdfDataUrl, originalPdfPreserved:!!originalPdfDataUrl},
      fieldProvenance: buildFieldProvenance(metadata, extraction.pages),
      manualStatus:'Em revisão'
    };
    doc.unmapped = buildUnmapped(extraction.pages, parsed.used, metadata, parsed.demands);
    doc.issues = buildIssues(doc);
    recordActivity(doc, `PDF importado e analisado: ${parsed.demands.length} item(ns) reconhecido(s).`);
    return doc;
  }

  async function handlePdfFiles(files) {
    const valid = [...files].filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!valid.length) return toast('Selecione um arquivo PDF.', 'error');
    $('#upload-progress').hidden = false;
    for (let i=0;i<valid.length;i++) {
      const file = valid[i];
      $('#progress-label').textContent = `Lendo ${file.name}`;
      $('#progress-percent').textContent = '0%';
      $('#progress-fill').style.width = '0%';
      try {
        const extraction = await extractPdf(file, ratio => {
          const pct = Math.round(ratio*100);
          $('#progress-percent').textContent = `${pct}%`;
          $('#progress-fill').style.width = `${pct}%`;
        });
        const doc = await normalizeNewDocument(file, extraction);
        workspace.documents.unshift(doc);
        selectedDocId = doc.id;
        scheduleSave();
        toast(`${file.name}: ${doc.demands.length} item(ns) identificado(s).`, 'success');
      } catch (err) {
        console.error(err);
        toast(`Falha ao ler ${file.name}: ${err.message}`, 'error');
      }
    }
    $('#upload-progress').hidden = true;
    renderAll();
    if (selectedDocId) openDocument(selectedDocId);
  }

  function makeSampleDocument(config) {
    const pageLines = config.rawText.split('\n').filter(Boolean);
    const demands = config.demands.map((d, i) => ({
      id: uid('demand'), item: String(i + 1), descricaoOriginal: d.desc,
      descricaoPadronizada: d.desc, categoria: classifyCategory(d.desc), unidade: d.unit,
      quantidade: d.qty, valorUnitario: d.unitPrice, valorTotal: d.total,
      pagina: 1, linhaOriginal: d.line, status: 'sugerido', observacoes: []
    }));
    const rawPages = [{ page: 1, lines: pageLines }];
    const metadata = { ...config.metadata };
    const doc = {
      id: uid('doc'), filename: config.filename, fileSize: 48231, importedAt: new Date().toISOString(),
      pageCount: 1, hasText: true, extractionMethod: 'exemplo demonstrativo', rawText: config.rawText,
      rawPages, normalized: metadata, demands, extraFields: [],
      unmapped: [{id:uid('extra'),pagina:1,texto:'Observação complementar: a entrega deverá atender também às unidades descentralizadas.',status:'nao_classificado',revisado:false}],
      activity: [], source: { mimeType:'application/pdf', demo:true }, manualStatus:'Em revisão', issues:[]
    };
    doc.issues = buildIssues(doc);
    recordActivity(doc, 'Exemplo demonstrativo carregado. Os dados não representam uma contratação real.');
    return doc;
  }
  function loadDemoWorkspace() {
    const first = makeSampleDocument({
      filename:'PCA_2027_Diretoria_Administrativa.pdf',
      metadata:{ exercicio:'2027', unidadeGestora:'UG 01 — Unidade Demonstrativa', departamento:'Diretoria Administrativa', responsavel:'Equipe de Planejamento', numeroProcesso:'0001.000123/2026-11', tipoContratacao:'Material', objeto:'Aquisição de materiais de expediente e apoio administrativo', justificativa:'Manter o abastecimento regular das unidades administrativas, com base no consumo histórico e na necessidade de reposição.', prioridade:'Alta', dataDesejada:'15/03/2027', valorGlobal:'18.900,00' },
      demands:[
        {desc:'Papel A4 branco 75 g/m²',unit:'Resma',qty:'300',unitPrice:'28,00',total:'8.400,00',line:'1 Papel A4 branco 75 g/m² Resma 300 28,00 8.400,00'},
        {desc:'Caneta esferográfica azul',unit:'Caixa',qty:'20',unitPrice:'45,00',total:'900,00',line:'2 Caneta esferográfica azul Caixa 20 45,00 900,00'},
        {desc:'Toner para impressora compatível',unit:'Unidade',qty:'40',unitPrice:'240,00',total:'9.600,00',line:'3 Toner para impressora compatível Unidade 40 240,00 9.600,00'}
      ],
      rawText:'PLANO DE CONTRATAÇÃO ANUAL — EXERCÍCIO 2027\nUNIDADE GESTORA: UG 01 — Unidade Demonstrativa\nDEPARTAMENTO REQUISITANTE: Diretoria Administrativa\nRESPONSÁVEL PELA DEMANDA: Equipe de Planejamento\nPROCESSO ADMINISTRATIVO: 0001.000123/2026-11\nOBJETO: Aquisição de materiais de expediente e apoio administrativo\nJUSTIFICATIVA: Manter o abastecimento regular das unidades administrativas, com base no consumo histórico e na necessidade de reposição.\nPRIORIDADE: Alta\nDATA PREVISTA: 15/03/2027\nVALOR GLOBAL ESTIMADO: R$ 18.900,00\nITEM DESCRIÇÃO UNIDADE QUANTIDADE VALOR UNITÁRIO VALOR TOTAL\n1 Papel A4 branco 75 g/m² Resma 300 28,00 8.400,00\n2 Caneta esferográfica azul Caixa 20 45,00 900,00\n3 Toner para impressora compatível Unidade 40 240,00 9.600,00\nObservação complementar: a entrega deverá atender também às unidades descentralizadas.'
    });
    const second = makeSampleDocument({
      filename:'PCA_2027_Gerencia_de_Projetos.pdf',
      metadata:{ exercicio:'2027', unidadeGestora:'UG 01 — Unidade Demonstrativa', departamento:'Gerência de Projetos', responsavel:'Coordenação de Projetos', numeroProcesso:'0001.000124/2026-10', tipoContratacao:'Material', objeto:'Materiais de apoio às atividades administrativas', justificativa:'Atender às atividades de planejamento, reuniões e elaboração de documentos técnicos.', prioridade:'Média', dataDesejada:'30/04/2027', valorGlobal:'2.800,00' },
      demands:[
        {desc:'Papel A4 branco 75 g/m²',unit:'Resma',qty:'100',unitPrice:'28,00',total:'2.800,00',line:'1 Papel A4 branco 75 g/m² Resma 100 28,00 2.800,00'}
      ],
      rawText:'PLANO SETORIAL DE CONTRATAÇÕES — 2027\nUNIDADE GESTORA: UG 01 — Unidade Demonstrativa\nDEPARTAMENTO REQUISITANTE: Gerência de Projetos\nRESPONSÁVEL: Coordenação de Projetos\nPROCESSO ADMINISTRATIVO: 0001.000124/2026-10\nOBJETO: Materiais de apoio às atividades administrativas\nJUSTIFICATIVA: Atender às atividades de planejamento, reuniões e elaboração de documentos técnicos.\nPRIORIDADE: Média\nDATA PREVISTA: 30/04/2027\nVALOR GLOBAL ESTIMADO: R$ 2.800,00\n1 Papel A4 branco 75 g/m² Resma 100 28,00 2.800,00'
    });
    workspace.documents.unshift(second, first);
    selectedDocId = second.id;
    scheduleSave();
    renderAll();
    openDocument(second.id);
    toast('Dois planos fictícios adicionados. Explore a malha fina para ver a demanda semelhante.', 'success');
  }

  function getDoc(id=selectedDocId) { return workspace.documents.find(d=>d.id===id) || null; }
  function getIssues(doc) { doc.issues = buildIssues(doc); return doc.issues; }
  function issueCount(doc) { return getIssues(doc).length; }
  function getSimilarGroups() {
    const all = workspace.documents.flatMap(doc => (doc.demands||[]).map(demand=>({doc,demand,department:doc.normalized?.departamento || doc.filename})));
    const groups = [];
    const used = new Set();
    for (let i=0;i<all.length;i++) {
      if (used.has(all[i].demand.id)) continue;
      const a = all[i];
      const matches = [a];
      const aText = normalizeComparable(a.demand.descricaoPadronizada || a.demand.descricaoOriginal || '');
      if (aText.length < 5) continue;
      for (let j=i+1;j<all.length;j++) {
        const b = all[j];
        if (b.doc.id === a.doc.id || used.has(b.demand.id)) continue;
        const bText = normalizeComparable(b.demand.descricaoPadronizada || b.demand.descricaoOriginal || '');
        const similarity = tokenDiceSimilarity(aText, bText);
        const sameCatalogItem = !!a.demand.catalogoId && a.demand.catalogoId === b.demand.catalogoId;
        const unitsCompatible = !a.demand.unidade || !b.demand.unidade || normalizeComparable(a.demand.unidade) === normalizeComparable(b.demand.unidade);
        if ((sameCatalogItem || similarity >= 0.72) && unitsCompatible) matches.push(b);
      }
      if (matches.length > 1) {
        matches.forEach(x=>used.add(x.demand.id));
        groups.push({title:a.demand.descricaoPadronizada||a.demand.descricaoOriginal,items:matches,kind:a.demand.catalogoId?'catálogo local / similaridade textual (sugestão)':'similaridade textual por termos (sugestão)'});
      }
    }
    return groups;
  }

  function tokenDiceSimilarity(a, b) {
    const A = new Set(a.split(' ').filter(x=>x.length>1));
    const B = new Set(b.split(' ').filter(x=>x.length>1));
    if (!A.size || !B.size) return 0;
    const intersection = [...A].filter(x=>B.has(x)).length;
    return (2*intersection)/(A.size+B.size);
  }

  function normalizeComparable(s) {
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\b(de|da|do|das|dos|para|com|e)\b/g,' ').replace(/\s+/g,' ').trim();
  }

  function renderAll() {
    renderOverview(); renderDocuments(); renderReview();
    $('#nav-doc-count').textContent = workspace.documents.length;
    $('#nav-issue-count').textContent = workspace.documents.reduce((s,d)=>s+issueCount(d),0);
    if (selectedDocId && getDoc()) renderDetail();
    document.dispatchEvent(new CustomEvent('pca:workspace-updated'));
  }
  function renderOverview() {
    const docs=workspace.documents;
    const demands=docs.reduce((s,d)=>s+(d.demands?.length||0),0);
    const issues=docs.reduce((s,d)=>s+issueCount(d),0);
    $('#metric-docs').textContent=docs.length;
    $('#metric-demands').textContent=demands;
    $('#metric-issues').textContent=issues;
    $('#metric-groups').textContent=getSimilarGroups().length;
    $('#recent-count').textContent=`${docs.length} registro${docs.length===1?'':'s'}`;
    const root=$('#recent-documents');
    if (!docs.length) { root.innerHTML='<div class="empty-state compact"><div class="empty-icon">▤</div><strong>Nenhum plano por aqui ainda</strong><p>Comece adicionando um PDF para visualizar os dados estruturados.</p></div>'; return; }
    root.innerHTML=docs.slice(0,5).map(doc=>`<div class="recent-item" data-open-doc="${escapeHtml(doc.id)}"><div class="pdf-tile">PDF</div><div class="recent-info"><div class="recent-name">${escapeHtml(doc.filename)}</div><div class="recent-meta">${escapeHtml(doc.normalized?.departamento||'Departamento não identificado')} · ${formatDate(doc.importedAt)}</div></div><div class="recent-amount">${doc.demands?.length||0} itens</div></div>`).join('');
  }
  function renderDocuments() {
    const q=($('#document-search')?.value||'').toLocaleLowerCase('pt-BR');
    const docs=workspace.documents.filter(d=>`${d.filename} ${d.normalized?.departamento||''} ${d.normalized?.objeto||''}`.toLocaleLowerCase('pt-BR').includes(q));
    $('#documents-total').textContent=`${docs.length} documento${docs.length===1?'':'s'}`;
    const root=$('#documents-list');
    if (!docs.length) { root.innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><strong>Nenhum documento encontrado</strong><p>Adicione um PDF ou ajuste o termo de busca.</p></div>'; return; }
    root.innerHTML=docs.map(doc=>{
      const count=issueCount(doc); const status=count?'Em revisão':'Sem apontamentos automáticos';
      return `<article class="document-card" data-open-doc="${escapeHtml(doc.id)}"><div class="document-card-top"><div class="pdf-tile">PDF</div><div class="document-card-title"><strong>${escapeHtml(doc.filename)}</strong><small>${escapeHtml(doc.normalized?.departamento||'Departamento não identificado')} · ${formatDate(doc.importedAt)}</small></div><span class="status-chip ${count?'':'ok'}">${count?'● Revisar':'✓ Sem apontamentos automáticos'}</span></div><div class="document-card-stats"><span><b>${doc.pageCount||0}</b> páginas</span><span><b>${doc.demands?.length||0}</b> demandas</span><span><b>${doc.unmapped?.length||0}</b> trechos extras</span><span><b>${count}</b> alertas</span></div></article>`;
    }).join('');
  }
  function renderReview() {
    const docs=workspace.documents;
    const issues=docs.flatMap(doc=>getIssues(doc).map(issue=>({doc,issue})));
    const errors=issues.filter(x=>x.issue.severity==='error').length;
    const warnings=issues.length-errors;
    $('#review-summary').innerHTML=`<div class="review-stat"><span>Alertas identificados</span><strong>${issues.length}</strong></div><div class="review-stat"><span>Falhas críticas de extração</span><strong>${errors}</strong></div><div class="review-stat"><span>Alertas para conferência</span><strong>${warnings}</strong></div>`;
    $('#review-count').textContent=`${issues.length} apontamento${issues.length===1?'':'s'}`;
    const list=$('#review-list');
    if (!issues.length) list.innerHTML='<div class="empty-state compact"><div class="empty-icon">✓</div><strong>Nenhum alerta no momento</strong><p>Adicione documentos para iniciar a malha fina.</p></div>';
    else list.innerHTML=issues.map(({doc,issue})=>`<div class="issue-row"><div class="issue-mark ${issue.severity==='error'?'danger':''}">${issue.severity==='error'?'!':'i'}</div><div class="issue-body"><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)} <span style="color:#a0a9b6">· ${escapeHtml(doc.filename)}</span></p></div><button class="issue-action" data-open-doc="${escapeHtml(doc.id)}">Revisar →</button></div>`).join('');
    const groups=getSimilarGroups();
    const sim=$('#similarity-list');
    if (!groups.length) sim.innerHTML='<div class="empty-state compact"><strong>Ainda não há grupos semelhantes</strong><p>Os cruzamentos aparecem quando há itens em mais de um plano.</p></div>';
    else sim.innerHTML=groups.map(g=>`<div class="similarity-group"><div class="similarity-title">${escapeHtml(g.title)}</div><p>${escapeHtml(g.kind)} · ${g.items.length} ocorrência(s) em ${new Set(g.items.map(x=>x.doc.id)).size} plano(s)</p><div class="similarity-tags">${g.items.map(x=>`<span>${escapeHtml(x.department)} · ${escapeHtml(x.demand.unidade||'unidade ?')} · ${escapeHtml(x.demand.quantidade||'?')}</span>`).join('')}</div></div>`).join('');
  }

  function openDocument(id) {
    selectedDocId=id; activeView='detail';
    $$('.view-panel').forEach(el=>el.hidden=true);
    $('#view-detail').hidden=false;
    $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view==='documents'));
    $('#breadcrumb-current').textContent='Análise do plano';
    renderDetail();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setView(view) {
    activeView=view;
    $$('.view-panel').forEach(el=>el.hidden=true);
    const target=$(`#view-${view}`);
    if (target) target.hidden=false;
    $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('#breadcrumb-current').textContent=({overview:'Visão geral',dashboard:'Dashboard',documents:'Planos recebidos',review:'Malha fina',plano:'Plano consolidado'})[view]||'Análise do plano';
    if (view==='documents') renderDocuments();
    if (view==='review') renderReview();
    if (view==='dashboard') document.dispatchEvent(new CustomEvent('pca:dashboard-open'));
    if (view==='plano') document.dispatchEvent(new CustomEvent('pca:consolidation-open'));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderDetail() {
    const doc=getDoc(); if (!doc) return;
    $('#detail-title').textContent=doc.filename;
    $('#detail-subtitle').textContent=`${doc.normalized?.departamento||'Departamento não identificado'} · Importado em ${formatDate(doc.importedAt)} · ${doc.pageCount||0} página(s)`;
    $('#side-filename').textContent=doc.filename;
    $('#side-filemeta').textContent=`${(doc.fileSize/1024/1024).toFixed(2)} MB · ${doc.pageCount||0} pág.`;
    const sourceButton=$('#open-source-pdf-btn');if(sourceButton){sourceButton.disabled=!doc.source?.originalPdfDataUrl;sourceButton.title=sourceButton.disabled?'O PDF original não foi preservado (arquivo acima do limite ou importação JSON antiga).':'';}
    $('#detail-status').textContent=issueCount(doc)?'Em revisão':'Sem apontamentos automáticos';
    $('#detail-status').className=`status-chip ${issueCount(doc)?'':'ok'}`;
    const ocrButton=$('#run-ocr-btn');if(ocrButton)ocrButton.remove();
    if(!doc.hasText&&doc.source?.originalPdfDataUrl){const b=document.createElement('button');b.id='run-ocr-btn';b.className='button button-ghost';b.dataset.runOcr=doc.id;b.textContent='Executar OCR (português)';$('.detail-actions')?.prepend(b);}
    $('#unmapped-nav-count').textContent=doc.unmapped?.length||0;
    $('#audit-nav-count').textContent=issueCount(doc);
    renderMetadataForm(doc); renderDemands(doc); renderExtraFields(doc); renderRaw(doc); renderUnmapped(doc); renderAudit(doc);
    setDetailTab(activeDetailTab);
  }
  function renderMetadataForm(doc) {
    $('#metadata-form').innerHTML=FIELD_DEFS.map(def=>{
      const val=doc.normalized?.[def.key]??'';
      const cls=def.width===3?'span-3':def.width===2?'span-2':'';
      let input='';
      if (def.type==='textarea') input=`<textarea data-meta-field="${def.key}" placeholder="${escapeHtml(def.placeholder||'')}" rows="${def.key==='justificativa'?3:2}">${escapeHtml(val)}</textarea>`;
      else if (def.type==='select') input=`<select data-meta-field="${def.key}">${def.options.map(x=>`<option value="${escapeHtml(x)}" ${val===x?'selected':''}>${escapeHtml(x||'Selecione...')}</option>`).join('')}</select>`;
      else input=`<input data-meta-field="${def.key}" value="${escapeHtml(val)}" placeholder="${escapeHtml(def.placeholder||'')}" />`;
      return `<div class="field ${cls}"><label>${escapeHtml(def.label)}</label>${input}</div>`;
    }).join('');
  }
  function renderDemands(doc) {
    const body=$('#demands-table-body');
    $('#no-demands').hidden=!!doc.demands.length;
    body.innerHTML=doc.demands.map(d=>{
      recalculateDemand(d,{initialize:true});
      const calculated = d.valorTotalCalculado ? formatMoney(parseBrazilianNumber(d.valorTotalCalculado)) : 'Informe quantidade e valor unitário';
      const mismatch = d.valorTotal && d.valorTotalCalculado && Math.abs(parseBrazilianNumber(d.valorTotal)-parseBrazilianNumber(d.valorTotalCalculado))>0.02;
      const catalogSuggestion=d.sugestaoCatalogo && normalizeComparable(d.sugestaoCatalogo)!==normalizeComparable(d.descricaoPadronizada||'')
        ? `<div class="catalog-suggestion"><small>Sugestão do catálogo local (${escapeHtml(d.catalogoId||'ID interno')}): ${escapeHtml(d.sugestaoCatalogo)}</small><button type="button" data-apply-catalog="${escapeHtml(d.id)}">Aplicar sugestão</button></div>` : (d.catalogoId?`<small class="catalog-match">Catálogo local: ${escapeHtml(d.catalogoId)} · sugestão aplicada</small>`:'');
      return `<tr data-demand-row="${escapeHtml(d.id)}"><td><input data-demand-field="item" value="${escapeHtml(d.item||'')}" aria-label="Número do item" /></td><td><input class="desc-input" data-demand-field="descricaoPadronizada" value="${escapeHtml(d.descricaoPadronizada||'')}" placeholder="Descrição normalizada" aria-label="Descrição padronizada" /><div class="demand-original">Original: ${escapeHtml(d.descricaoOriginal||'—')}</div>${catalogSuggestion}</td><td><input data-demand-field="categoria" value="${escapeHtml(d.categoria||'Não classificado')}" aria-label="Categoria" /></td><td><input data-demand-field="unidade" value="${escapeHtml(d.unidade||'')}" aria-label="Unidade" /><small class="demand-original">Unidade original: ${escapeHtml(d.unidadeOriginal||d.unidade||'—')}</small></td><td><input data-demand-field="quantidade" value="${escapeHtml(d.quantidade||'')}" aria-label="Quantidade" inputmode="decimal" /></td><td><input data-demand-field="valorUnitario" value="${escapeHtml(d.valorUnitario||'')}" aria-label="Valor unitário" inputmode="decimal" /></td><td><input data-demand-field="valorTotal" value="${escapeHtml(d.valorTotal||'')}" aria-label="Valor total" inputmode="decimal" /><small class="calc-hint ${mismatch?'warn':''}" data-calc-hint="${escapeHtml(d.id)}">${mismatch?'Divergente · cálculo automático: '+escapeHtml(calculated):'Cálculo automático: '+escapeHtml(calculated)}</small><button class="apply-calc" type="button" data-apply-calc="${escapeHtml(d.id)}" ${!d.valorTotalCalculado?'hidden':''}>Aplicar cálculo</button></td><td><span class="page-label">Pág. ${escapeHtml(d.pagina||'?')}</span></td><td><button class="delete-row" data-delete-demand="${escapeHtml(d.id)}" title="Excluir item">×</button></td></tr>`;
    }).join('');
  }
  function renderExtraFields(doc) {
    const root=$('#extra-fields-list');
    if (!doc.extraFields?.length) { root.innerHTML='<div class="table-empty">Nenhum campo adicional criado. Use “Adicionar campo” para registrar uma informação fora do modelo.</div>'; return; }
    root.innerHTML=doc.extraFields.map(f=>`<div class="extra-row" data-extra-row="${escapeHtml(f.id)}"><input data-extra-field="label" value="${escapeHtml(f.label||'')}" placeholder="Nome do campo" aria-label="Nome do campo"/><input data-extra-field="value" value="${escapeHtml(f.value||'')}" placeholder="Valor / informação complementar" aria-label="Valor do campo"/><button data-delete-extra="${escapeHtml(f.id)}" title="Excluir campo">×</button></div>`).join('');
  }
  function renderRaw(doc) { $('#raw-content').textContent=doc.rawText||'Nenhum texto extraído.'; }
  function renderUnmapped(doc) {
    const rows=doc.unmapped||[];
    $('#unmapped-count').textContent=`${rows.length} trechos`; 
    const root=$('#unmapped-list');
    if (!rows.length) { root.innerHTML='<div class="empty-state compact"><strong>Nenhum trecho fora da classificação</strong><p>O texto integral continua preservado na aba de conteúdo bruto.</p></div>'; return; }
    root.innerHTML=rows.map(row=>`<div class="unmapped-item ${row.revisado?'is-reviewed':''}"><span class="page-label">Pág. ${escapeHtml(row.pagina||'?')}</span><p>${escapeHtml(row.texto)}</p><div class="unmapped-actions"><button data-promote-extra="${escapeHtml(row.id)}">Guardar como campo</button><button class="secondary-action" data-review-extra="${escapeHtml(row.id)}">${row.revisado?'Revisado ✓':'Marcar revisado'}</button></div></div>`).join('');
  }
  function renderAudit(doc) {
    const issues=getIssues(doc);
    const passed=[];
    if (doc.filename) passed.push({title:'Arquivo de origem identificado',detail:'Nome e metadados básicos preservados.',severity:'ok'});
    if (doc.rawText) passed.push({title:'Conteúdo bruto preservado',detail:`${doc.rawText.length.toLocaleString('pt-BR')} caracteres de texto extraído disponíveis para conferência.`,severity:'ok'});
    if (doc.demands.length) passed.push({title:'Demandas estruturadas',detail:`${doc.demands.length} linha(s) reconhecida(s) por heurística e vinculada(s) à página de origem.`,severity:'ok'});
    $('#audit-score').textContent=`${passed.length} verificações registradas`; 
    $('#audit-checks').innerHTML=[...passed.map(x=>({...x,status:'OK'})),...issues.map(x=>({...x,status:x.severity==='error'?'Atenção':'Revisar'}))].map(x=>`<div class="audit-check"><span class="audit-icon ${x.severity==='warning'?'warn':x.severity==='error'?'fail':''}">${x.severity==='ok'?'✓':x.severity==='error'?'!':'i'}</span><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail)}</p></div><span class="audit-result">${escapeHtml(x.status||'')}</span></div>`).join('');
    $('#activity-log').innerHTML=(doc.activity||[]).map(a=>`<div class="activity-row"><span class="activity-dot"></span><div><p>${escapeHtml(a.message)}</p><small>${new Date(a.at).toLocaleString('pt-BR')}</small></div></div>`).join('') || '<div class="table-empty">Sem eventos registrados.</div>';
  }
  function setDetailTab(tab) {
    activeDetailTab=tab;
    $$('.detail-tab').forEach(el=>el.classList.toggle('active',el.dataset.detailTab===tab));
    $$('.detail-pane').forEach(el=>el.classList.toggle('active',el.id===`pane-${tab}`));
  }

  function updateMetadata(key,value) {
    const doc=getDoc(); if (!doc) return;
    doc.normalized[key]=value;
    doc.fieldProvenance=doc.fieldProvenance||{};
    const previous=doc.fieldProvenance[key]||{};
    doc.fieldProvenance[key]={...previous,method:'edição manual',previousValue:previous.currentValue??previous.extractedValue??'',currentValue:value,reviewed:true,updatedAt:new Date().toISOString()};
    doc.issues=buildIssues(doc);
    scheduleSave();
  }
  function markDemandFieldManual(demand,key,method='edição manual') {
    if(!demand)return false;
    // Qualquer alteração posterior invalida a revisão individual anterior.
    const reviewWasInvalidated=!!demand.rev;
    if(reviewWasInvalidated){demand.rev=false;demand.revisadoEm=null;demand.revisaoInvalidadaEm=new Date().toISOString();}
    demand.provenance=demand.provenance||{};
    const previous=demand.provenance[key]||{};
    demand.provenance[key]={...previous,method,previousValue:previous.currentValue??previous.extractedValue??'',currentValue:demand[key]??'',reviewed:true,updatedAt:new Date().toISOString()};
    return reviewWasInvalidated;
  }
  function addDemand() {
    const doc=getDoc(); if(!doc)return;
    doc.demands.push({id:uid('demand'),item:String(doc.demands.length+1),descricaoOriginal:'',descricaoPadronizada:'',categoria:'Não classificado',unidade:'',quantidade:'',valorUnitario:'',valorTotal:'',pagina:null,linhaOriginal:'',status:'manual',observacoes:[]});
    recordActivity(doc,'Demanda adicionada manualmente pelo gestor.');
    renderDetail(); scheduleSave();
  }
  function addExtraField(label='',value='') {
    const doc=getDoc();if(!doc)return;
    doc.extraFields.push({id:uid('field'),label,value,source:'manual'});
    renderExtraFields(doc); scheduleSave();
  }
  function safeIdentifier(value, prefix='id') {
    const s = String(value || '');
    return /^[A-Za-z0-9_-]{1,100}$/.test(s) ? s : uid(prefix);
  }
  function sanitizeText(value, max=1000000) { return String(value ?? '').slice(0,max); }
  function sanitizeProvenance(raw) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) return {};
    const out={};
    Object.entries(raw).slice(0,100).forEach(([key,value])=>{
      if(!/^[A-Za-z0-9_-]{1,80}$/.test(key) || !value || typeof value!=='object' || Array.isArray(value)) return;
      out[key]={method:sanitizeText(value.method||'',100),page:Number(value.page)||null,sourceText:sanitizeText(value.sourceText||'',20000),previousValue:sanitizeText(value.previousValue||'',10000),currentValue:sanitizeText(value.currentValue||'',10000),reviewed:!!value.reviewed,updatedAt:sanitizeText(value.updatedAt||'',80),confidence:Number.isFinite(value.confidence)?value.confidence:null};
    });
    return out;
  }
  function validateImportedState(data) {
    if (!data || !Array.isArray(data.documents)) throw new Error('JSON inválido: não foi encontrada a coleção documents.');
    const allowedSchemas = ['pca-lab-workspace/v1','pca-lab-workspace/v2',undefined,null];
    if (!allowedSchemas.includes(data.schema)) throw new Error(`Versão de arquivo não suportada: ${data.schema}.`);
    const seen = new Set();
    const docs=data.documents.slice(0,5000).map(raw=>{
      const id0=safeIdentifier(raw.id,'doc');
      const id=seen.has(id0)?uid('doc'):id0; seen.add(id);
      const normalized={};
      for (const f of FIELD_DEFS) normalized[f.key]=sanitizeText(raw.normalized?.[f.key]||'',20000);
      normalized.orcamento=sanitizeText(raw.normalized?.orcamento||'',100);
      const demands=(Array.isArray(raw.demands)?raw.demands:[]).slice(0,50000).map(d=>({
        ...d, id:safeIdentifier(d.id,'demand'), item:sanitizeText(d.item,80), tipo:sanitizeText(d.tipo,100),
        descricaoOriginal:sanitizeText(d.descricaoOriginal,10000),descricaoPadronizada:sanitizeText(d.descricaoPadronizada,10000),
        categoria:sanitizeText(d.categoria,150),unidade:sanitizeText(d.unidade,100),unidadeOriginal:sanitizeText(d.unidadeOriginal,100),catalogoId:sanitizeText(d.catalogoId,100),codigoCatmat:sanitizeText(d.codigoCatmat,100),sugestaoCatalogo:sanitizeText(d.sugestaoCatalogo,1000),catalogoAlias:sanitizeText(d.catalogoAlias,200),quantidade:sanitizeText(d.quantidade,100),
        valorUnitario:sanitizeText(d.valorUnitario,100),valorTotal:sanitizeText(d.valorTotal,100),valorTotalOriginal:sanitizeText(d.valorTotalOriginal,100),valorTotalCalculado:sanitizeText(d.valorTotalCalculado,100),valorTotalModo:['manual','calculado','documento'].includes(d.valorTotalModo)?d.valorTotalModo:'',revisadoEm:sanitizeText(d.revisadoEm||'',80),revisaoInvalidadaEm:sanitizeText(d.revisaoInvalidadaEm||'',80),decisao:sanitizeText(d.decisao||'',200),
        linhaOriginal:sanitizeText(d.linhaOriginal,20000), pagina:Number(d.pagina)||null, provenance:sanitizeProvenance(d.provenance), rev:!!d.rev
      }));
      return {
        id,filename:sanitizeText(raw.filename||'documento-importado.pdf',500),fileSize:Number(raw.fileSize)||0,
        importedAt:raw.importedAt||new Date().toISOString(),pageCount:Number(raw.pageCount)||0,hasText:raw.hasText!==false,
        extractionMethod:sanitizeText(raw.extractionMethod||'importado-json',100),rawText:sanitizeText(raw.rawText||'',5000000),rawTextOcr:sanitizeText(raw.rawTextOcr||'',5000000),rawTextOriginal:sanitizeText(raw.rawTextOriginal||'',5000000),rawPagesOriginal:Array.isArray(raw.rawPagesOriginal)?raw.rawPagesOriginal.slice(0,10000).map(pg=>({page:Number(pg.page)||null,lines:Array.isArray(pg.lines)?pg.lines.slice(0,5000).map(x=>sanitizeText(x,20000)):[]})):[],rawPages:Array.isArray(raw.rawPages)?raw.rawPages.slice(0,10000).map(pg=>({page:Number(pg.page)||null,lines:Array.isArray(pg.lines)?pg.lines.slice(0,5000).map(x=>sanitizeText(x,20000)):[]})):[],rawPagesOcr:Array.isArray(raw.rawPagesOcr)?raw.rawPagesOcr.slice(0,10000).map(pg=>({page:Number(pg.page)||null,lines:Array.isArray(pg.lines)?pg.lines.slice(0,5000).map(x=>sanitizeText(x,20000)):[]})):[],
        normalized, demands,
        extraFields:Array.isArray(raw.extraFields)?raw.extraFields.slice(0,10000).map(f=>({...f,id:safeIdentifier(f.id,'field'),label:sanitizeText(f.label,500),value:sanitizeText(f.value,20000)})):[],
        unmapped:Array.isArray(raw.unmapped)?raw.unmapped.slice(0,50000).map(u=>({...u,id:safeIdentifier(u.id,'extra'),pagina:Number(u.pagina)||null,texto:sanitizeText(u.texto,20000),revisado:!!u.revisado})):[],
        activity:Array.isArray(raw.activity)?raw.activity.slice(0,1000).map(a=>({id:safeIdentifier(a.id,'activity'),message:sanitizeText(a.message,2000),at:a.at||new Date().toISOString()})):[],
        source:{mimeType:sanitizeText(raw.source?.mimeType||'application/pdf',100),lastModified:Number(raw.source?.lastModified)||null,demo:!!raw.source?.demo,originalPdfDataUrl:(typeof raw.source?.originalPdfDataUrl==='string'&&/^data:application\/(?:pdf|octet-stream);base64,[A-Za-z0-9+/=]+$/.test(raw.source.originalPdfDataUrl)&&raw.source.originalPdfDataUrl.length<=22000000)?raw.source.originalPdfDataUrl:null,originalPdfPreserved:false},fieldProvenance:sanitizeProvenance(raw.fieldProvenance),
        manualStatus:sanitizeText(raw.manualStatus||'Em revisão',100),issues:[]
      };
    });
    // Garante unicidade dos identificadores em todo o workspace importado.
    const itemIds=new Set(), extraIds=new Set(), unmappedIds=new Set();
    docs.forEach(doc=>{
      doc.source.originalPdfPreserved=!!doc.source.originalPdfDataUrl;
      doc.demands.forEach(d=>{if(itemIds.has(d.id))d.id=uid('demand');itemIds.add(d.id);});
      doc.extraFields.forEach(f=>{if(extraIds.has(f.id))f.id=uid('field');extraIds.add(f.id);});
      doc.unmapped.forEach(u=>{if(unmappedIds.has(u.id))u.id=uid('extra');unmappedIds.add(u.id);});
    });
    return {schema:SCHEMA,appVersion:APP_VERSION,createdAt:data.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),documents:docs};
  }

  function exportJson() {
    const payload={...workspace,schema:SCHEMA,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),note:'Exportação completa do workspace: dados estruturados, texto extraído, campos extras, histórico e arquivo PDF original quando preservado (data URL).'};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`pca-lab-workspace-${new Date().toISOString().slice(0,10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Arquivo JSON exportado com os estados atuais.', 'success');
  }
  async function importJsonFile(file) {
    try {
      if(file.size>100*1024*1024)throw new Error('O JSON excede o limite de 100 MB para importação nesta demonstração.');
      const data=JSON.parse(await file.text());
      const incoming=validateImportedState(data);
      const merged=workspace.documents.length>0 ? await askMerge(incoming.documents.length) : 'replace';
      if (!merged) return;
      if (merged==='append') {
        const existingIds = new Set(workspace.documents.map(d => d.id));
        const existingDemandIds = new Set(workspace.documents.flatMap(d => (d.demands||[]).map(x=>x.id)));
        const existingExtraIds = new Set(workspace.documents.flatMap(d => (d.extraFields||[]).map(x=>x.id)));
        const existingUnmappedIds = new Set(workspace.documents.flatMap(d => (d.unmapped||[]).map(x=>x.id)));
        const additions = incoming.documents.map(doc => {
          if (existingIds.has(doc.id)) doc.id = uid('doc');
          existingIds.add(doc.id);
          (doc.demands||[]).forEach(x=>{if(existingDemandIds.has(x.id))x.id=uid('demand');existingDemandIds.add(x.id);});
          (doc.extraFields||[]).forEach(x=>{if(existingExtraIds.has(x.id))x.id=uid('field');existingExtraIds.add(x.id);});
          (doc.unmapped||[]).forEach(x=>{if(existingUnmappedIds.has(x.id))x.id=uid('extra');existingUnmappedIds.add(x.id);});
          return doc;
        });
        workspace.documents=[...additions,...workspace.documents];
      } else workspace=incoming;
      selectedDocId=workspace.documents[0]?.id||null;
      await saveWorkspace(); renderAll();
      if (selectedDocId) openDocument(selectedDocId); else setView('overview');
      toast(`${incoming.documents.length} documento(s) importado(s) do JSON.`, 'success');
    } catch(err) { console.error(err); toast(`Não foi possível importar: ${err.message}`, 'error'); }
  }
  function askMerge(count) {
    return new Promise(resolve=>{
      const root=$('#modal-root');
      root.innerHTML=`<div class="modal-backdrop"><div class="modal"><h3>Como importar o workspace?</h3><p>O arquivo contém ${count} documento(s). Você já possui ${workspace.documents.length} no navegador. Escolha se deseja substituir o workspace atual ou acrescentar os documentos importados.</p><div class="modal-actions"><button class="button button-ghost" data-modal-choice="cancel">Cancelar</button><button class="button button-ghost" data-modal-choice="append">Acrescentar</button><button class="button button-primary" data-modal-choice="replace">Substituir</button></div></div></div>`;
      root.querySelectorAll('[data-modal-choice]').forEach(btn=>btn.addEventListener('click',()=>{const value=btn.dataset.modalChoice;root.innerHTML='';resolve(value==='cancel'?null:value);}));
    });
  }
  function deleteDocument() {
    const doc=getDoc(); if(!doc)return;
    const root=$('#modal-root');
    root.innerHTML=`<div class="modal-backdrop"><div class="modal"><h3>Excluir este plano?</h3><p>O documento <strong>${escapeHtml(doc.filename)}</strong> e seus dados estruturados serão removidos do armazenamento local deste navegador. Exporte um JSON antes, caso precise guardar uma cópia.</p><div class="modal-actions"><button class="button button-ghost" data-delete-choice="no">Cancelar</button><button class="button button-primary" data-delete-choice="yes">Excluir plano</button></div></div></div>`;
    root.querySelectorAll('[data-delete-choice]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.dataset.deleteChoice==='yes') { workspace.documents=workspace.documents.filter(d=>d.id!==doc.id); selectedDocId=null; scheduleSave(); }
      root.innerHTML=''; renderAll(); setView('documents');
      if(btn.dataset.deleteChoice==='yes') toast('Plano excluído do armazenamento local.');
    }));
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Falha ao preservar PDF original'));const pdfBlob=new Blob([file],{type:'application/pdf'});reader.readAsDataURL(pdfBlob);});
  }
  function buildFieldProvenance(metadata, pages) {
    const mapping={exercicio:/exerc[ií]cio|ano de refer[eê]ncia/i,unidadeGestora:/unidade gestora|[oó]rg[aã]o demandante/i,departamento:/departamento|setor requisitante|unidade requisitante/i,responsavel:/respons[aá]vel|elaborador/i,numeroProcesso:/processo/i,tipoContratacao:/natureza|tipo de contrata[cç][aã]o/i,objeto:/objeto|descri[cç][aã]o do objeto/i,justificativa:/justificativa|fundamenta[cç][aã]o da necessidade/i,prioridade:/prioridade/i,dataDesejada:/data desejada|data prevista|m[eê]s pretendido/i,valorGlobal:/valor global|valor total|estimativa do valor/i};
    const all=pages.flatMap(p=>p.lines.map(text=>({page:p.page,text})));
    const result={};
    Object.entries(metadata).forEach(([key,value])=>{if(!value)return;const source=all.find(x=>mapping[key]?.test(x.text));result[key]={method:'extração heurística',page:source?.page||null,sourceText:source?.text||'',reviewed:false,confidence:null};});
    return result;
  }
  function demandById(id) { const doc=getDoc(); return doc?.demands.find(d=>d.id===id)||null; }
  function refreshCalculationHint(demand) {
    const row=$(`[data-demand-row="${CSS.escape(demand.id)}"]`);
    if(!row)return;
    const total=row.querySelector('[data-demand-field="valorTotal"]');
    const hint=row.querySelector('[data-calc-hint]');
    const apply=row.querySelector('[data-apply-calc]');
    if(total)total.value=demand.valorTotal||'';
    const calculated=demand.valorTotalCalculado?formatMoney(parseBrazilianNumber(demand.valorTotalCalculado)):'Informe quantidade e valor unitário';
    const mismatch=demand.valorTotal&&demand.valorTotalCalculado&&Math.abs(parseBrazilianNumber(demand.valorTotal)-parseBrazilianNumber(demand.valorTotalCalculado))>0.02;
    if(hint){hint.textContent=(mismatch?'Divergente · cálculo automático: ':'Cálculo automático: ')+calculated;hint.classList.toggle('warn',!!mismatch);}
    if(apply)apply.hidden=!demand.valorTotalCalculado;
  }
  async function runOcrForDocument(docId) {
    const doc=workspace.documents.find(d=>d.id===docId);if(!doc)return;
    if(!doc.source?.originalPdfDataUrl)return toast('O PDF original não foi preservado neste registro. Reimporte o arquivo para habilitar OCR.','error');
    try {
      if(!window.Tesseract){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o motor OCR.'));document.head.appendChild(s);});}
      if(!window.pdfjsLib)throw new Error('PDF.js indisponível.');
      const base64=doc.source.originalPdfDataUrl.split(',')[1];
      const binary=atob(base64);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
      const worker=await Tesseract.createWorker('por',1,{logger:m=>{if(m.status==='recognizing text'){$('#progress-label').textContent=`OCR página ${Math.max(1,Math.round((m.progress||0)*100))}%`;}}});
      const pages=[];let full='';
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.6});
        const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const result=await worker.recognize(canvas);
        const lines=String(result.data.text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        pages.push({page:i,lines});full+=`--- PÁGINA ${i} · OCR ---\n${lines.join('\n')}\n\n`;
      }
      await worker.terminate();
      doc.rawPagesOriginal=doc.rawPages;doc.rawTextOriginal=doc.rawText;doc.rawPagesOcr=pages;doc.rawTextOcr=full;doc.rawPages=pages;doc.rawText=full;doc.hasText=full.replace(/\s/g,'').length>25;doc.extractionMethod='PDF.js + Tesseract OCR (português)';
      const parsed=parseDemandLines(pages);const metadata=extractMetadata(pages,doc.filename);
      Object.entries(metadata).forEach(([k,v])=>{if(v&&!doc.normalized[k])doc.normalized[k]=v;});
      doc.fieldProvenance={...(doc.fieldProvenance||{}),...buildFieldProvenance(metadata,pages)};
      const existing=new Set(doc.demands.map(d=>normalizeComparable(d.descricaoOriginal||'')));
      parsed.demands.forEach(d=>{if(!existing.has(normalizeComparable(d.descricaoOriginal)))doc.demands.push(d);});
      const extras=buildUnmapped(pages,parsed.used,metadata,parsed.demands);doc.unmapped=[...(doc.unmapped||[]),...extras];
      recordActivity(doc,`OCR executado em ${pages.length} página(s). Confirme cada resultado e evite duplicidades.`);
      doc.issues=buildIssues(doc);await saveWorkspace();renderAll();openDocument(doc.id);toast('OCR concluído. Os dados foram acrescentados como sugestões.','success');
    }catch(err){console.error(err);toast(`OCR não concluído: ${err.message}`,'error');}
  }

  function bindEvents() {
    $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
    $$('[data-open-view="documents"]').forEach(btn=>btn.addEventListener('click',()=>setView('documents')));
    $('#browse-pdf-btn').addEventListener('click',()=>$('#pdf-file-input').click());
    $('#browse-pdf-btn-2').addEventListener('click',()=>$('#pdf-file-input').click());
    $('#browse-pdf-btn-3').addEventListener('click',()=>$('#pdf-file-input').click());
    $('#pdf-file-input').addEventListener('change',e=>{handlePdfFiles(e.target.files);e.target.value='';});
    const drop=$('#drop-zone');
    ['dragenter','dragover'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.add('drag-over');}));
    ['dragleave','drop'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.remove('drag-over');}));
    drop.addEventListener('drop',e=>handlePdfFiles(e.dataTransfer.files));
    $('#import-json-btn').addEventListener('click',()=>$('#json-file-input').click());
    $('#json-file-input').addEventListener('change',e=>{if(e.target.files[0])importJsonFile(e.target.files[0]);e.target.value='';});
    $('#export-json-btn').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('pca:open-export')));
    $('#load-demo-btn').addEventListener('click',loadDemoWorkspace);
    $('#document-search').addEventListener('input',renderDocuments);
    $('#back-to-docs').addEventListener('click',()=>setView('documents'));
    $('#save-document-btn').addEventListener('click',async()=>{const doc=getDoc();if(doc){recordActivity(doc,'Alterações salvas pelo gestor.');await saveWorkspace();renderDetail();toast('Alterações salvas no navegador.','success');}});
    $('#export-current-plan-btn').addEventListener('click',()=>{if(selectedDocId)document.dispatchEvent(new CustomEvent('pca:open-export',{detail:{documentId:selectedDocId}}));});
    $('#delete-document-btn').addEventListener('click',deleteDocument);
    const sourceBtn=document.createElement('button');sourceBtn.className='button button-ghost';sourceBtn.id='open-source-pdf-btn';sourceBtn.textContent='Abrir PDF original';$('.detail-heading .detail-actions')?.prepend(sourceBtn);
    sourceBtn.addEventListener('click',()=>{const doc=getDoc();if(!doc?.source?.originalPdfDataUrl)return toast('PDF original indisponível neste registro.','error');const a=document.createElement('a');a.href=doc.source.originalPdfDataUrl;a.target='_blank';a.rel='noopener';a.click();});
    $('#add-demand-btn').addEventListener('click',addDemand);
    $('#add-extra-btn').addEventListener('click',()=>addExtraField());
    $('#copy-raw-btn').addEventListener('click',async()=>{const doc=getDoc();try{await navigator.clipboard.writeText(doc?.rawText||'');toast('Texto bruto copiado.','success');}catch(_){toast('Não foi possível acessar a área de transferência.','error');}});
    $$('.detail-tab').forEach(btn=>btn.addEventListener('click',()=>setDetailTab(btn.dataset.detailTab)));
    document.addEventListener('click',e=>{
      const open=e.target.closest('[data-open-doc]'); if(open){openDocument(open.dataset.openDoc);return;}
      const del=e.target.closest('[data-delete-demand]'); if(del){const doc=getDoc();doc.demands=doc.demands.filter(d=>d.id!==del.dataset.deleteDemand);recordActivity(doc,'Uma demanda foi removida manualmente.');renderDetail();scheduleSave();return;}
      const promote=e.target.closest('[data-promote-extra]'); if(promote){const doc=getDoc();const row=doc.unmapped.find(u=>u.id===promote.dataset.promoteExtra);if(row){doc.extraFields.push({id:uid('field'),label:`Trecho livre · página ${row.pagina}`,value:row.texto,source:'promovido de não mapeado'});doc.unmapped=doc.unmapped.filter(u=>u.id!==row.id);recordActivity(doc,'Trecho não classificado promovido para campo complementar.');renderDetail();scheduleSave();}return;}
      const markExtra=e.target.closest('[data-review-extra]'); if(markExtra){const doc=getDoc();const row=doc.unmapped.find(u=>u.id===markExtra.dataset.reviewExtra);if(row){row.revisado=!row.revisado;row.revisadoEm=row.revisado?new Date().toISOString():null;recordActivity(doc,row.revisado?'Trecho complementar marcado como revisado.':'Revisão do trecho reaberta.');renderUnmapped(doc);renderAudit(doc);scheduleSave();}return;}
      const extraDel=e.target.closest('[data-delete-extra]');if(extraDel){const doc=getDoc();doc.extraFields=doc.extraFields.filter(x=>x.id!==extraDel.dataset.deleteExtra);recordActivity(doc,'Campo adicional removido.');renderExtraFields(doc);scheduleSave();return;}
      const applyCalc=e.target.closest('[data-apply-calc]');if(applyCalc){const doc=getDoc(),d=demandById(applyCalc.dataset.applyCalc);if(d&&d.valorTotalCalculado){d.valorTotal=d.valorTotalCalculado;d.valorTotalModo='calculado';markDemandFieldManual(d,'valorTotal','cálculo automático');recordActivity(doc,`Valor total do item ${d.item||''} atualizado pela fórmula quantidade × valor unitário.`);refreshCalculationHint(d);doc.issues=buildIssues(doc);scheduleSave();toast('Cálculo aplicado ao valor total.','success');}return;}
      const applyCatalog=e.target.closest('[data-apply-catalog]');if(applyCatalog){const doc=getDoc(),d=demandById(applyCatalog.dataset.applyCatalog);if(d&&d.sugestaoCatalogo){const before=d.descricaoPadronizada;d.descricaoPadronizada=d.sugestaoCatalogo;d.categoria=d.categoria||classifyCategory(d.descricaoPadronizada);d.catalogoId=d.catalogoId||findCatalogMatch(d.descricaoOriginal)?.id||'';markDemandFieldManual(d,'descricaoPadronizada','sugestão do catálogo local aplicada pelo gestor');recordActivity(doc,`Item ${d.item||''}: sugestão de catálogo local aplicada. Descrição anterior: ${before||'não informada'}.`);renderDetail();scheduleSave();toast('Sugestão do catálogo aplicada; descrição original preservada.','success');}return;}
      const ocr=e.target.closest('[data-run-ocr]');if(ocr){runOcrForDocument(ocr.dataset.runOcr);return;}
    });
    document.addEventListener('focusin',e=>{const field=e.target.closest('[data-demand-field],[data-meta-field]');if(field&&field.dataset.initialValue===undefined)field.dataset.initialValue=field.value;});
    document.addEventListener('change',e=>{const field=e.target.closest('[data-demand-field]');if(!field)return;const row=field.closest('[data-demand-row]'),doc=getDoc(),demand=doc?.demands.find(d=>d.id===row?.dataset.demandRow);if(demand&&field.dataset.initialValue!==field.value){recordActivity(doc,`Item ${demand.item||'?'}: campo ${field.dataset.demandField} alterado de "${field.dataset.initialValue||''}" para "${field.value}".`);field.dataset.initialValue=field.value;scheduleSave();}});
    document.addEventListener('input',e=>{
      const meta=e.target.closest('[data-meta-field]'); if(meta){updateMetadata(meta.dataset.metaField,meta.value);return;}
      const field=e.target.closest('[data-demand-field]');if(field){const row=field.closest('[data-demand-row]');const doc=getDoc();const demand=doc.demands.find(d=>d.id===row.dataset.demandRow);if(demand){const key=field.dataset.demandField;demand[key]=field.value;const reviewReopened=markDemandFieldManual(demand,key);if(reviewReopened)recordActivity(doc,`A revisão do item ${demand.item||'?'} foi reaberta porque um dado foi alterado.`);if(key==='valorTotal'){demand.valorTotalModo='manual';refreshCalculationHint(demand);}if(key==='quantidade'||key==='valorUnitario'){recalculateDemand(demand,{fromQuantityOrPrice:true});refreshCalculationHint(demand);}doc.issues=buildIssues(doc);scheduleSave();}return;}
      const extra=e.target.closest('[data-extra-field]');if(extra){const row=extra.closest('[data-extra-row]');const doc=getDoc();const item=doc.extraFields.find(f=>f.id===row.dataset.extraRow);if(item){item[extra.dataset.extraField]=extra.value;scheduleSave();}}
    });
    document.addEventListener('change',e=>{
      const meta=e.target.closest('[data-meta-field]'); if(meta){updateMetadata(meta.dataset.metaField,meta.value);renderOverview();renderDocuments();renderReview();}
    });
  }

  function init() {
    bindEvents();
    loadWorkspace();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.addEventListener('DOMContentLoaded',init);
  window.PCA={ws:()=>workspace,save:scheduleSave,saveNow:saveWorkspace,toast,esc:escapeHtml,num:parseBrazilianNumber,money:formatMoney,sim:getSimilarGroups,log:recordActivity,doc:getDoc,openDocument,setView,render:renderAll,uid,buildIssues,recalculateDemand,exportJson,exportPayload:()=>({...JSON.parse(JSON.stringify(workspace)),schema:SCHEMA,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),note:'Estado completo do workspace. Inclui PDFs originais somente quando preservados no navegador.'}),markDemandFieldManual,normalizeComparable,findCatalogMatch,classifyCategory};
})();
