/* PCA Lab 0.3.0 — dashboard analítico e central de pré-visualização/exportação. */
(() => {
  'use strict';
  const P = () => window.PCA;
  const $ = (s, root=document) => root.querySelector(s);
  const esc = v => P().esc(v);
  const num = v => P().num(v);
  const numCell = v => { const n=num(v); return Number.isFinite(n) ? n : ''; };
  const money = v => P().money(v);
  const docs = () => P().ws().documents || [];
  const demands = () => docs().flatMap(doc => (doc.demands || []).map(d => ({doc,d})));
  const totalOf = d => {
    const total = num(d.valorTotal);
    if (Number.isFinite(total)) return total;
    const q=num(d.quantidade), u=num(d.valorUnitario);
    return Number.isFinite(q)&&Number.isFinite(u)?q*u:0;
  };
  const docTotal = doc => (doc.demands||[]).reduce((sum,d)=>sum+totalOf(d),0);
  const priorityOf = ({doc,d}) => d.prioridade || doc.normalized?.prioridade || 'Não informada';
  const departmentOf = doc => doc.normalized?.departamento || doc.normalized?.unidadeGestora || doc.filename || 'Unidade não identificada';
  const groupBy = (items, keyFn) => {
    const map=new Map();
    items.forEach(item=>{const key=keyFn(item)||'Não informado';map.set(key,(map.get(key)||0)+1);});
    return [...map.entries()].sort((a,b)=>b[1]-a[1]);
  };
  const barList = (entries, valueFormatter = v => String(v), color='blue') => {
    if(!entries.length)return '<div class="dash-empty">Sem dados suficientes para este gráfico.</div>';
    const max=Math.max(1,...entries.map(x=>x[1]));
    return `<div class="dash-bars">${entries.slice(0,8).map(([label,value])=>`<div class="dash-bar-row"><div class="dash-bar-label" title="${esc(label)}">${esc(label)}</div><div class="dash-bar-track"><i class="${color}" style="width:${Math.max(2,(value/max)*100)}%"></i></div><strong>${esc(valueFormatter(value))}</strong></div>`).join('')}</div>`;
  };
  function renderDashboard() {
    const root=$('#view-dashboard');if(!root)return;
    const D=docs(),R=demands(),total=R.reduce((s,r)=>s+totalOf(r.d),0);
    const issueCount=D.reduce((s,d)=>s+(P().buildIssues(d)||[]).length,0);
    const reviewed=R.filter(r=>r.d.rev).length;
    const unmapped=D.reduce((s,d)=>s+(d.unmapped||[]).filter(x=>!x.revisado).length,0);
    const groups=P().sim();
    const byUG=groupBy(R,r=>r.doc.normalized?.unidadeGestora||r.doc.normalized?.departamento||'Unidade não identificada');
    const byPriority=groupBy(R,priorityOf);
    const byCategory=groupBy(R,r=>r.d.categoria||'Não classificado');
    const byDepartment=D.map(doc=>({label:departmentOf(doc),value:docTotal(doc),items:(doc.demands||[]).length})).sort((a,b)=>b.value-a.value).slice(0,8);
    const maxSpend=Math.max(1,...byDepartment.map(x=>x.value));
    root.innerHTML=`
      <div class="page-title-row"><div><div class="eyebrow"><span class="eyebrow-line"></span> INTELIGÊNCIA DO PLANEJAMENTO</div><h1>Dashboard</h1><p>Indicadores do workspace atual. Os números refletem os dados importados e as revisões registradas neste navegador.</p></div><div class="dash-actions"><button class="button button-ghost" data-open-view="documents">Ver planos</button><button class="button button-primary" data-open-export>Pré-visualizar exportação</button></div></div>
      <div class="dash-kpis">
        <article class="dash-kpi"><span>Planos recebidos</span><b>${D.length}</b><small>documentos no workspace</small></article>
        <article class="dash-kpi"><span>Demandas identificadas</span><b>${R.length}</b><small>itens estruturados</small></article>
        <article class="dash-kpi"><span>Valor estimado dos itens</span><b>${esc(money(total))}</b><small>soma dos valores atuais por item</small></article>
        <article class="dash-kpi warning"><span>Pontos para revisão</span><b>${issueCount}</b><small>${unmapped} trecho(s) não mapeado(s) aguardando conferência</small></article>
      </div>
      <div class="dash-progress-panel panel"><div class="panel-heading"><div><div class="eyebrow">QUALIDADE DO WORKSPACE</div><h3>Andamento das revisões</h3></div><span class="subtle-count">${R.length?Math.round(reviewed/R.length*100):0}% revisado</span></div><div class="dash-progress"><i style="width:${R.length?Math.round(reviewed/R.length*100):0}%"></i></div><div class="dash-progress-meta"><span>${reviewed} de ${R.length} itens marcados como revisados</span><span>${R.length-reviewed} pendentes</span></div></div>
      <div class="dash-grid">
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">DISTRIBUIÇÃO</div><h3>Demandas por unidade / departamento</h3></div></div>${barList(byUG)}</section>
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">PRIORIZAÇÃO</div><h3>Demandas por prioridade</h3></div></div>${barList(byPriority)}</section>
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">CLASSIFICAÇÃO</div><h3>Demandas por categoria</h3></div></div>${barList(byCategory)}</section>
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">VALORES ESTIMADOS</div><h3>Valor por plano</h3></div></div>${byDepartment.length?`<div class="dash-spend">${byDepartment.map(x=>`<div class="dash-spend-row"><div><strong>${esc(x.label)}</strong><small>${x.items} item(ns)</small></div><div class="dash-spend-bar"><i style="width:${(x.value/maxSpend)*100}%"></i></div><b>${esc(money(x.value))}</b></div>`).join('')}</div>`:'<div class="dash-empty">Nenhum plano importado.</div>'}</section>
      </div>
      <div class="dash-bottom-grid">
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">POSSÍVEIS AGRUPAMENTOS</div><h3>Demandas semelhantes</h3></div><span class="subtle-count">${groups.length} grupo(s)</span></div>${groups.length?groups.slice(0,6).map(g=>`<div class="dash-sim-row"><strong>${esc(g.title)}</strong><small>${esc(g.kind)} · ${g.items.length} ocorrências</small></div>`).join(''):'<div class="dash-empty">Ainda não há grupos de demandas semelhantes.</div>'}</section>
        <section class="panel dash-panel"><div class="panel-heading"><div><div class="eyebrow">INTEGRIDADE</div><h3>Situação dos documentos</h3></div></div><div class="dash-doc-status"><div><b>${D.filter(d=>d.hasText).length}</b><span>PDFs com texto detectável</span></div><div><b>${D.filter(d=>!d.hasText).length}</b><span>PDFs possivelmente digitalizados</span></div><div><b>${D.filter(d=>(d.unmapped||[]).length>0).length}</b><span>Planos com conteúdo não mapeado</span></div><div><b>${D.filter(d=>d.source?.originalPdfPreserved).length}</b><span>PDFs originais preservados</span></div></div></section>
      </div>
      <p class="dash-disclaimer">Indicadores gerenciais de apoio. Não equivalem a atesto de conformidade, aprovação orçamentária ou autorização de contratação.</p>`;
  }

  function buildExportSheets(documentId=null) {
    const D=documentId?docs().filter(doc=>doc.id===documentId):docs(),R=D.flatMap(doc=>(doc.demands||[]).map(d=>({doc,d})));
    const headers=['Unidade gestora','Departamento requisitante','Exercício','Arquivo de origem','Processo','Item','Tipo de item','Descrição original','Descrição padronizada','Categoria','Unidade de fornecimento','Quantidade','Valor unitário (R$)','Valor total atual (R$)','Valor calculado (R$)','Justificativa','Prioridade','Data desejada','Fonte de recurso','Elemento de despesa','Página de origem','Linha original do PDF','Revisado pelo gestor','Data da revisão','Decisão sobre similaridade','ID catálogo local','Descrição sugerida pelo catálogo','Unidade original do PDF','Código CATMAT/CATSER informado','Alias de catálogo correspondente'];
    const consolidated=[headers];
    R.forEach(({doc,d},index)=>{
      const rowNumber=index+2,quantity=num(d.quantidade),unitPrice=num(d.valorUnitario);
      const liveFormula=Number.isFinite(quantity)&&Number.isFinite(unitPrice)?{formula:`L${rowNumber}*M${rowNumber}`,value:Math.round((quantity*unitPrice+Number.EPSILON)*100)/100}:numCell(d.valorTotalCalculado);
      const currentTotal=num(d.valorTotal);
      const totalValue=Number.isFinite(currentTotal)?currentTotal:Number.isFinite(quantity)&&Number.isFinite(unitPrice)?Math.round((quantity*unitPrice+Number.EPSILON)*100)/100:'';
      consolidated.push([
        doc.normalized?.unidadeGestora||'',doc.normalized?.departamento||'',doc.normalized?.exercicio||'',doc.filename||'',doc.normalized?.numeroProcesso||'',d.item||'',d.tipo||doc.normalized?.tipoContratacao||'',d.descricaoOriginal||'',d.descricaoPadronizada||'',d.categoria||'',d.unidade||'',numCell(d.quantidade),numCell(d.valorUnitario),totalValue,liveFormula,d.justificativa||doc.normalized?.justificativa||'',d.prioridade||doc.normalized?.prioridade||'',d.dataDesejada||doc.normalized?.dataDesejada||'',d.fonte||'',d.elemento||'',d.pagina||'',d.linhaOriginal||'',d.rev?'Sim':'Não',d.revisadoEm||'',d.decisao||'',d.catalogoId||'',d.sugestaoCatalogo||'',d.unidadeOriginal||d.unidade||'',d.codigoCatmat||'',d.catalogoAlias||''
      ]);
    });
    const plans=[['Arquivo','UG','Departamento','Exercício','Processo','Objeto','Justificativa','Prioridade','Data desejada','Valor global informado (R$)','Soma dos itens (R$)','Itens','Não mapeados pendentes','Problemas detectados','Status de revisão','PDF original preservado']];
    D.forEach(doc=>plans.push([doc.filename,doc.normalized?.unidadeGestora||'',doc.normalized?.departamento||'',doc.normalized?.exercicio||'',doc.normalized?.numeroProcesso||'',doc.normalized?.objeto||'',doc.normalized?.justificativa||'',doc.normalized?.prioridade||'',doc.normalized?.dataDesejada||'',numCell(doc.normalized?.valorGlobal),docTotal(doc),(doc.demands||[]).length,(doc.unmapped||[]).filter(x=>!x.revisado).length,(P().buildIssues(doc)||[]).length,doc.manualStatus||'Em revisão',doc.source?.originalPdfPreserved?'Sim':'Não']));
    const unmapped=[['Arquivo','UG','Departamento','Página','Trecho preservado','Status de revisão']];
    D.forEach(doc=>(doc.unmapped||[]).forEach(x=>unmapped.push([doc.filename,doc.normalized?.unidadeGestora||'',doc.normalized?.departamento||'',x.pagina||'',x.texto||'',x.revisado?'Revisado':'Pendente'])));
    const extras=[['Arquivo','Tipo de registro','Nome do campo','Valor','Método de origem','Página','Revisado']];
    D.forEach(doc=>{
      (doc.extraFields||[]).forEach(x=>extras.push([doc.filename,'Campo adicional',x.label||'',x.value||'',x.source||'manual','','']));
      Object.entries(doc.fieldProvenance||{}).forEach(([key,value])=>extras.push([doc.filename,'Proveniência de campo',key,value?.sourceText||value?.method||'',value?.method||'',value?.page||'',value?.reviewed?'Sim':'Não']));
    });
    const audit=[['Arquivo','Código','Severidade','Apontamento','Detalhe']];
    D.forEach(doc=>(P().buildIssues(doc)||[]).forEach(x=>audit.push([doc.filename,x.code||'',x.severity||'',x.title||'',x.detail||''])));
    const history=[['Arquivo','Data/hora','Evento']];
    D.forEach(doc=>(doc.activity||[]).forEach(x=>history.push([doc.filename,x.at||'',x.message||''])));
    const raw=[['Arquivo','Página','Ordem da linha','Texto bruto extraído']];
    D.forEach(doc=>(doc.rawPages||[]).forEach(page=>(page.lines||[]).forEach((line,i)=>raw.push([doc.filename,page.page||'',i+1,line]))));
    const budgetMap=new Map();
    D.forEach(doc=>{
      const ug=String(doc.normalized?.unidadeGestora||'').trim(),year=String(doc.normalized?.exercicio||'').trim();
      const key=`${ug?P().normalizeComparable(ug):`sem-ug:${doc.id}`}|${year}`;
      if(!budgetMap.has(key))budgetMap.set(key,{ug:ug||'Unidade Gestora não identificada',year,docs:[],budgets:[],total:0});
      const g=budgetMap.get(key);g.docs.push(doc);g.total+=docTotal(doc);const b=num(doc.normalized?.orcamento);if(Number.isFinite(b)&&b>0&&!g.budgets.includes(b))g.budgets.push(b);
    });
    const budgets=[['Unidade gestora','Exercício','Orçamento informado (R$)','Limite de 30% (R$)','Soma estimada dos itens (R$)','Situação preliminar','Planos considerados']];
    [...budgetMap.values()].forEach(g=>{
      const budget=g.budgets.length===1?g.budgets[0]:null,limit=budget===null?null:budget*.30;
      const status=!g.ug||g.ug==='Unidade Gestora não identificada'?'Não aferido: UG ausente':!g.year?'Não aferido: exercício ausente':!g.budgets.length?'Não aferido: orçamento ausente':g.budgets.length>1?'Divergência de orçamentos':g.total>limit?'Acima de 30%':'Dentro de 30%';
      budgets.push([g.ug,g.year,budget??'',limit??'',g.total,status,g.docs.map(x=>x.filename).join(' | ')]);
    });
    return [
      {name:'PCA Consolidado',rows:consolidated},
      {name:'Orçamentos',rows:budgets},
      {name:'Planos',rows:plans},
      {name:'Não Mapeados',rows:unmapped},
      {name:'Campos Extras',rows:extras},
      {name:'Auditoria',rows:audit},
      {name:'Histórico',rows:history},
      {name:'Texto Bruto',rows:raw}
    ];
  }
  function buildWorkspacePreviewTables(payload) {
    const D=payload?.documents||[];
    const plans=[['Arquivo','Tamanho (bytes)','Páginas','UG','Departamento','Exercício','Processo','Objeto','Justificativa','Prioridade','Data desejada','Valor global informado','Orçamento de referência','Status do plano','PDF original preservado']];
    const items=[['Arquivo','UG','Departamento','ID da demanda','Item','Descrição original','Descrição padronizada','Categoria','Unidade','Quantidade','Valor unitário','Valor total atual','Valor total calculado','Fórmula','Prioridade','Justificativa','Data desejada','CATMAT/CATSER informado','ID do catálogo local','Página','Linha original','Revisado','Data da revisão','Decisão','Observações']];
    const extras=[['Arquivo','Tipo','Campo','Valor','Origem','Página','Revisado']];
    const provenance=[['Arquivo','Registro','Item','Campo','Método','Texto de origem','Página','Revisado','Atualizado em']];
    const unmapped=[['Arquivo','Página','Trecho preservado','Revisado','Data da revisão']];
    const raw=[['Arquivo','Página','Ordem da linha','Texto bruto']];
    const history=[['Arquivo','Data/hora','Evento']];
    const attachments=[['Arquivo','Tipo de preservação','Tamanho (bytes)','Disponibilidade no JSON']];
    D.forEach(doc=>{
      const n=doc.normalized||{};
      plans.push([doc.filename||'',doc.fileSize??'',doc.pageCount??'',n.unidadeGestora||'',n.departamento||'',n.exercicio||'',n.numeroProcesso||'',n.objeto||'',n.justificativa||'',n.prioridade||'',n.dataDesejada||'',n.valorGlobal??'',n.orcamento??'',doc.manualStatus||'Em revisão',doc.source?.originalPdfDataUrl?'Sim':'Não']);
      (doc.demands||[]).forEach(d=>items.push([
        doc.filename||'',n.unidadeGestora||'',n.departamento||'',d.id||'',d.item||'',d.descricaoOriginal||'',d.descricaoPadronizada||'',d.categoria||'',d.unidade||'',d.quantidade??'',d.valorUnitario??'',d.valorTotal??'',d.valorTotalCalculado??'',d.calculo?.formula||'quantidade × valor unitário',d.prioridade||n.prioridade||'',d.justificativa||n.justificativa||'',d.dataDesejada||n.dataDesejada||'',d.codigoCatmat||'',d.catalogoId||'',d.pagina??'',d.linhaOriginal||'',d.rev?'Sim':'Não',d.revisadoEm||'',d.decisao||'',Array.isArray(d.observacoes)?d.observacoes.join(' | '):(d.observacoes||'')
      ]));
      (doc.extraFields||[]).forEach(x=>extras.push([doc.filename||'','Campo complementar',x.label||'',x.value??'',x.source||'manual',x.page??'',x.reviewed?'Sim':'Não']));
      Object.entries(doc.fieldProvenance||{}).forEach(([field,x])=>provenance.push([doc.filename||'','Plano','',field,x?.method||'',x?.sourceText||'',x?.page??'',x?.reviewed?'Sim':'Não',x?.updatedAt||'']));
      (doc.demands||[]).forEach(d=>Object.entries(d.provenance||{}).forEach(([field,x])=>provenance.push([doc.filename||'','Demanda',d.item||d.id||'',field,x?.method||'',x?.sourceText||'',x?.page??'',x?.reviewed?'Sim':'Não',x?.updatedAt||''])));
      (doc.unmapped||[]).forEach(x=>unmapped.push([doc.filename||'',x.pagina??'',x.texto||'',x.revisado?'Sim':'Não',x.revisadoEm||'']));
      (doc.rawPages||[]).forEach(page=>(page.lines||[]).forEach((line,i)=>raw.push([doc.filename||'',page.page??'',i+1,line])));
      (doc.activity||[]).forEach(x=>history.push([doc.filename||'',x.at||'',x.message||'']));
      attachments.push([doc.filename||'','PDF original',doc.fileSize??'',doc.source?.originalPdfDataUrl?'Incluído como data URL':'Não preservado']);
    });
    return [
      {name:'Planos e metadados',rows:plans},
      {name:'Demandas e cálculos',rows:items},
      {name:'Campos complementares',rows:extras},
      {name:'Proveniência dos campos',rows:provenance},
      {name:'Trechos não mapeados',rows:unmapped},
      {name:'Texto bruto',rows:raw},
      {name:'Histórico',rows:history},
      {name:'Arquivos de origem',rows:attachments}
    ];
  }
  const formatPreviewValue = v => {
    if(v===null||v===undefined)return '';
    if(typeof v==='number')return v.toLocaleString('pt-BR',{maximumFractionDigits:4});
    if(v&&typeof v==='object'&&v.formula)return `=${v.formula} → ${Number(v.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    if(Array.isArray(v))return v.map(formatPreviewValue).join(' | ');
    if(typeof v==='object')return JSON.stringify(v);
    return String(v);
  };
  let exportSheets=[], workspaceTables=[], exportPayload=null, exportFilename='pca-lab-consolidado.xlsx', exportJsonFilename='pca-lab-workspace.json', currentSheet=0, currentPage=0, pageSize=50, currentDataTable=0, dataTablePage=0, dataPageSize=50, exportMode='excel';
  function renderSheetPreview() {
    const sheet=exportSheets[currentSheet];if(!sheet)return;
    const rows=sheet.rows||[];const head=rows[0]||[];const data=rows.slice(1);
    const pages=Math.max(1,Math.ceil(data.length/pageSize));currentPage=Math.min(currentPage,pages-1);
    const start=currentPage*pageSize,body=data.slice(start,start+pageSize);
    $('#export-sheet-name').textContent=sheet.name;
    $('#export-sheet-meta').textContent=`${data.length.toLocaleString('pt-BR')} registro(s) · página ${currentPage+1} de ${pages} · linhas ${data.length?start+1:0}–${Math.min(start+body.length,data.length)}`;
    $('#export-table-preview').innerHTML=`<table class="export-preview-table"><thead><tr>${head.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(v=>`<td>${esc(formatPreviewValue(v))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(1,head.length)}">Nenhum registro nesta planilha.</td></tr>`}</tbody></table>`;
    const prev=$('#export-preview-prev'),next=$('#export-preview-next'),label=$('#export-preview-page');
    if(prev)prev.disabled=currentPage<=0;if(next)next.disabled=currentPage>=pages-1;if(label)label.textContent=`Página ${currentPage+1}/${pages}`;
  }
  function renderWorkspaceTablePreview() {
    const table=workspaceTables[currentDataTable];if(!table)return;
    const rows=table.rows||[],head=rows[0]||[],data=rows.slice(1);
    const pages=Math.max(1,Math.ceil(data.length/dataPageSize));dataTablePage=Math.min(dataTablePage,pages-1);
    const start=dataTablePage*dataPageSize,body=data.slice(start,start+dataPageSize);
    $('#export-data-table-name').textContent=table.name;
    $('#export-data-table-meta').textContent=`${data.length.toLocaleString('pt-BR')} registro(s) · página ${dataTablePage+1} de ${pages} · linhas ${data.length?start+1:0}–${Math.min(start+body.length,data.length)}`;
    $('#export-data-table-preview').innerHTML=`<table class="export-preview-table"><thead><tr>${head.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(v=>`<td>${esc(formatPreviewValue(v))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(1,head.length)}">Nenhum registro nesta seção.</td></tr>`}</tbody></table>`;
    const prev=$('#export-data-table-prev'),next=$('#export-data-table-next'),label=$('#export-data-table-page');
    if(prev)prev.disabled=dataTablePage<=0;if(next)next.disabled=dataTablePage>=pages-1;if(label)label.textContent=`Página ${dataTablePage+1}/${pages}`;
  }
  function showExportMode(mode) {
    exportMode=mode;
    $('#export-excel-pane').hidden=mode!=='excel';
    $('#export-data-table-pane').hidden=mode!=='data';
    $('#export-json-pane').hidden=mode!=='json';
    document.querySelectorAll('[data-export-mode]').forEach(b=>b.classList.toggle('active',b.dataset.exportMode===mode));
  }
  function openExportPreview(event) {
    const documentId=event?.detail?.documentId||null;
    const selectedDoc=documentId?docs().find(doc=>doc.id===documentId):null;
    exportSheets=buildExportSheets(documentId);currentSheet=0;currentPage=0;pageSize=50;
    const wholePayload=P().exportPayload();
    exportPayload=documentId?{...wholePayload,documents:wholePayload.documents.filter(doc=>doc.id===documentId),exportScope:'plano-individual'}:wholePayload;
    workspaceTables=buildWorkspacePreviewTables(exportPayload);currentDataTable=0;dataTablePage=0;dataPageSize=50;
    const baseName=selectedDoc?String(selectedDoc.filename||'plano').replace(/\.pdf$/i,'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,70):'consolidado';
    const dateStamp=new Date().toISOString().slice(0,10);
    exportFilename=`pca-lab-${baseName}-${dateStamp}.xlsx`;
    exportJsonFilename=`pca-lab-${selectedDoc?baseName:'workspace'}-${dateStamp}.json`;
    const exportJsonString=JSON.stringify(exportPayload,null,2);
    const exportJsonKB=new Blob([exportJsonString]).size/1024;
    const previewPayload=JSON.parse(exportJsonString);
    let embeddedPdfCount=0;
    previewPayload.documents.forEach(doc=>{if(doc.source?.originalPdfDataUrl){embeddedPdfCount++;doc.source.originalPdfDataUrl=`[PDF original preservado — conteúdo binário incluído no arquivo JSON baixado; ${Math.round(doc.fileSize/1024).toLocaleString('pt-BR')} KB]`;}});
    const json=JSON.stringify(previewPayload,null,2);
    const totalRows=exportSheets.reduce((s,x)=>s+Math.max(0,x.rows.length-1),0);
    const exportDocCount=exportPayload.documents.length;
    const exportDemandCount=exportPayload.documents.reduce((sum,doc)=>sum+(doc.demands||[]).length,0);
    const root=$('#modal-root');
    root.innerHTML=`<div class="export-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização de exportação"><section class="export-dialog"><header class="export-dialog-header"><div><div class="eyebrow">SAÍDA DOS DADOS</div><h2>Pré-visualização e exportação</h2><p>${selectedDoc ? `Plano individual: ${esc(selectedDoc.filename)}` : 'Workspace completo: confira as informações antes de baixar os arquivos.'}</p></div><button class="export-close" data-export-close aria-label="Fechar">×</button></header><div class="export-summary-strip"><div><b>${exportDocCount}</b><span>planos</span></div><div><b>${exportDemandCount}</b><span>itens</span></div><div><b>${totalRows.toLocaleString('pt-BR')}</b><span>linhas em planilhas</span></div><div><b>${exportJsonKB.toLocaleString('pt-BR',{maximumFractionDigits:1})} KB</b><span>JSON estimado</span></div></div><div class="export-mode-tabs"><button class="active" data-export-mode="excel">Excel · planilhas</button><button data-export-mode="data">Dados completos · tabela</button><button data-export-mode="json">JSON · ${selectedDoc?'plano atual':'workspace completo'}</button></div><section id="export-excel-pane"><div class="export-toolbar"><div><label for="export-sheet-select">Planilha</label><select id="export-sheet-select">${exportSheets.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('')}</select></div><div class="export-sheet-description"><strong id="export-sheet-name"></strong><small id="export-sheet-meta"></small></div><button class="button button-primary" data-download-xlsx>Baixar Excel (.xlsx)</button></div><div class="export-preview-pagination"><label>Linhas por página <select id="export-page-size"><option value="25">25</option><option value="50" selected>50</option><option value="100">100</option><option value="250">250</option></select></label><div><button type="button" class="button button-ghost button-small" id="export-preview-prev" disabled>← Anterior</button><span id="export-preview-page">Página 1/1</span><button type="button" class="button button-ghost button-small" id="export-preview-next" disabled>Próxima →</button></div></div><div class="export-table-scroll" id="export-table-preview"></div><p class="export-footnote">A prévia permite percorrer todas as linhas de cada aba. O arquivo Excel será exportado com todas as linhas e oito planilhas.</p></section><section id="export-data-table-pane" hidden><div class="export-toolbar"><div><label for="export-data-table-select">Conjunto de dados</label><select id="export-data-table-select">${workspaceTables.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('')}</select></div><div class="export-sheet-description"><strong id="export-data-table-name"></strong><small id="export-data-table-meta"></small></div><span class="export-data-note">Prévia tabular dos registros que compõem o JSON.</span></div><div class="export-preview-pagination"><label>Linhas por página <select id="export-data-page-size"><option value="25">25</option><option value="50" selected>50</option><option value="100">100</option><option value="250">250</option></select></label><div><button type="button" class="button button-ghost button-small" id="export-data-table-prev" disabled>← Anterior</button><span id="export-data-table-page">Página 1/1</span><button type="button" class="button button-ghost button-small" id="export-data-table-next" disabled>Próxima →</button></div></div><div class="export-table-scroll" id="export-data-table-preview"></div><p class="export-footnote">Esta visão organiza em tabelas os metadados, demandas, proveniência, campos extras, trechos não mapeados, texto bruto, histórico e arquivos de origem. Para consultar a estrutura integral, incluindo propriedades aninhadas, use a aba JSON.</p></section><section id="export-json-pane" hidden><div class="export-json-heading"><div><strong>${selectedDoc?'JSON do plano':'Workspace JSON'}</strong><small>Mostra a estrutura, dados brutos, campos complementares, revisões e histórico. ${embeddedPdfCount?`${embeddedPdfCount} PDF(s) binário(s) aparecem resumidos nesta prévia; o download JSON leva os arquivos completos.`:'Nenhum binário PDF está embutido neste workspace.'}</small></div><div class="export-json-actions"><button class="button button-ghost" data-copy-json>Copiar JSON</button><button class="button button-primary" data-download-json>Baixar JSON</button></div></div><pre id="export-json-preview" class="export-json-preview">${esc(json)}</pre></section><footer class="export-dialog-footer"><span><i></i> Dados processados neste navegador</span><button class="button button-ghost" data-export-close>Fechar prévia</button></footer></section></div>`;
    renderSheetPreview();renderWorkspaceTablePreview();showExportMode('data');
  }
  function downloadJson() {
    const json=JSON.stringify(exportPayload||P().exportPayload(),null,2);
    const blob=new Blob([json],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=exportJsonFilename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    P().toast(exportPayload?.exportScope==='plano-individual'?'JSON do plano exportado.':'Workspace JSON exportado.','success');
  }
  function bind() {
    const nav=document.createElement('button');nav.className='nav-link';nav.dataset.view='dashboard';nav.innerHTML='<span class="nav-icon">▥</span> Dashboard';
    const menu=$('.main-nav');const docsNav=$('[data-view="documents"]');if(menu&&docsNav)menu.insertBefore(nav,docsNav.nextSibling);
    nav.addEventListener('click',()=>P().setView('dashboard'));
    const root=document.createElement('section');root.id='view-dashboard';root.className='view-panel';root.hidden=true;
    $('.page-wrap').insertBefore(root,$('#view-documents'));
    root.addEventListener('click',e=>{const v=e.target.closest('[data-open-view]');if(v){P().setView(v.dataset.openView);return;}const ex=e.target.closest('[data-open-export]');if(ex)openExportPreview();});
    document.addEventListener('pca:dashboard-open',renderDashboard);
    document.addEventListener('pca:workspace-updated',()=>{if(!$('#view-dashboard')?.hidden)renderDashboard();});
    document.addEventListener('pca:open-export',openExportPreview);
    $('#modal-root').addEventListener('click',async e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-export-close')){$('#modal-root').innerHTML='';return;}
      if(button.id==='export-preview-prev'){currentPage=Math.max(0,currentPage-1);renderSheetPreview();return;}
      if(button.id==='export-preview-next'){currentPage++;renderSheetPreview();return;}
      if(button.id==='export-data-table-prev'){dataTablePage=Math.max(0,dataTablePage-1);renderWorkspaceTablePreview();return;}
      if(button.id==='export-data-table-next'){dataTablePage++;renderWorkspaceTablePreview();return;}
      if(button.dataset.exportMode){showExportMode(button.dataset.exportMode);return;}
      if(button.hasAttribute('data-download-xlsx')){
        try{window.PCAExcel.download(exportSheets,exportFilename);P().toast('Planilha Excel gerada.','success');}
        catch(err){P().toast(`Falha ao gerar Excel: ${err.message}`,'error');}return;
      }
      if(button.hasAttribute('data-download-json')){downloadJson();return;}
      if(button.hasAttribute('data-copy-json')){try{await navigator.clipboard.writeText(JSON.stringify(exportPayload,null,2));P().toast('JSON copiado.','success');}catch(_){P().toast('Não foi possível copiar o JSON.','error');}return;}
      if(button.hasAttribute('data-open-export')){openExportPreview();return;}
    });
    $('#modal-root').addEventListener('change',e=>{
      if(e.target.id==='export-sheet-select'){currentSheet=Number(e.target.value)||0;currentPage=0;renderSheetPreview();}
      else if(e.target.id==='export-page-size'){pageSize=Number(e.target.value)||50;currentPage=0;renderSheetPreview();}
      else if(e.target.id==='export-data-table-select'){currentDataTable=Number(e.target.value)||0;dataTablePage=0;renderWorkspaceTablePreview();}
      else if(e.target.id==='export-data-page-size'){dataPageSize=Number(e.target.value)||50;dataTablePage=0;renderWorkspaceTablePreview();}
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('.export-backdrop'))$('#modal-root').innerHTML='';});
    renderDashboard();
  }
  document.addEventListener('DOMContentLoaded',bind);
  window.PCAInsights={renderDashboard,buildExportSheets,buildWorkspacePreviewTables,openExportPreview};
})();
