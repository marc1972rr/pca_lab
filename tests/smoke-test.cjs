const fs = require('fs');
const vm = require('vm');
const path = require('path');
const os = require('os');
const context = {
  console, TextEncoder, Uint8Array, Uint32Array, DataView, Math, Date, Number, String, Object, Array, Map, Set, RegExp, Promise,
  document: { addEventListener() {}, querySelector(){ return null; }, querySelectorAll(){ return []; } },
  navigator: {}, location: {protocol:'http:'},
  setTimeout, clearTimeout
};
context.window = context;
vm.createContext(context);
for (const file of ['catalogo-itens.js','xlsx-export.js','app.js','dashboard.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), context, {filename:file});
}
const P=context.PCA;
const checks=[];
const catalog=context.PCACatalog;
const catalogPaper=catalog.find('Papel A4 branco 75 g/m²');
checks.push({test:'catálogo local sugere papel A4',actual:catalogPaper?.id,expected:'LOCAL-EXP-001',ok:catalogPaper?.id==='LOCAL-EXP-001'});
checks.push({test:'normalizar unidade und.',actual:catalog.normalizeUnit('und.'),expected:'Unidade',ok:catalog.normalizeUnit('und.')==='Unidade'});
checks.push({test:'normalizar unidade cx.',actual:catalog.normalizeUnit('cx.'),expected:'Caixa',ok:catalog.normalizeUnit('cx.')==='Caixa'});
for (const [input,expected] of [['1.200',1200],['1.234,56',1234.56],['R$ 18.900,00',18900],['1.5',1.5]]) {
  const actual=P.num(input); checks.push({test:`parse ${input}`,actual,expected,ok:Math.abs(actual-expected)<1e-8});
}
const d={quantidade:'300',valorUnitario:'28,00',valorTotal:'',valorTotalModo:''};
P.recalculateDemand(d,{initialize:true});
checks.push({test:'calcular 300 × 28',actual:d.valorTotal,expected:'8.400',ok:P.num(d.valorTotal)===8400});
d.quantidade='400';P.recalculateDemand(d,{fromQuantityOrPrice:true});
checks.push({test:'recalcular após editar quantidade',actual:d.valorTotal,expected:'11.200',ok:P.num(d.valorTotal)===11200});
d.valorTotal='12.000';d.valorTotalModo='manual';d.quantidade='500';P.recalculateDemand(d,{fromQuantityOrPrice:true});
checks.push({test:'preservar total manual e apresentar cálculo à parte',actual:{total:d.valorTotal,calc:d.valorTotalCalculado},expected:{total:'12.000',calc:'14.000'},ok:P.num(d.valorTotal)===12000&&P.num(d.valorTotalCalculado)===14000});
const reviewedItem={rev:true,revisadoEm:'2026-11-13',valorTotal:'100'};P.markDemandFieldManual(reviewedItem,'valorTotal','edição manual');
checks.push({test:'edição posterior reabre revisão individual',actual:{rev:reviewedItem.rev,revisadoEm:reviewedItem.revisadoEm},expected:{rev:false,revisadoEm:null},ok:reviewedItem.rev===false&&reviewedItem.revisadoEm===null});
const docs=[
 {id:'doc-a',filename:'Plano A.pdf',fileSize:100,source:{originalPdfPreserved:true},normalized:{unidadeGestora:'UG 01',departamento:'Setor A',exercicio:'2027',numeroProcesso:'P-1',objeto:'Materiais',justificativa:'Reposição',prioridade:'Alta',valorGlobal:'8400',orcamento:'50000'},demands:[{id:'a1',item:'1',descricaoOriginal:'Papel A4',descricaoPadronizada:'Papel A4',catalogoId:'LOCAL-EXP-001',categoria:'Material de expediente',unidade:'Resma',quantidade:'300',valorUnitario:'28,00',valorTotal:'8.400',valorTotalCalculado:'8.400',pagina:1,linhaOriginal:'1 Papel A4 Resma 300 28,00 8.400',rev:true,revisadoEm:'2026-11-13'}],unmapped:[],extraFields:[],activity:[],rawPages:[{page:1,lines:['1 Papel A4 Resma 300 28,00 8.400']}],fieldProvenance:{}},
 {id:'doc-b',filename:'Plano B.pdf',fileSize:100,source:{originalPdfPreserved:false},normalized:{unidadeGestora:'UG 01',departamento:'Setor B',exercicio:'2027',numeroProcesso:'P-2',objeto:'Materiais',justificativa:'Uso administrativo',prioridade:'Média',valorGlobal:'2800',orcamento:'50000'},demands:[{id:'b1',item:'1',descricaoOriginal:'Papel A4 branco',descricaoPadronizada:'Papel A4 branco',catalogoId:'LOCAL-EXP-001',categoria:'Material de expediente',unidade:'Resma',quantidade:'100',valorUnitario:'28,00',valorTotal:'2.800',valorTotalCalculado:'2.800',pagina:2,linhaOriginal:'1 Papel A4 branco Resma 100 28,00 2.800',rev:false}],unmapped:[{id:'u1',pagina:2,texto:'Entrega por unidade',revisado:false}],extraFields:[],activity:[],rawPages:[{page:2,lines:['1 Papel A4 branco Resma 100 28,00 2.800']}],fieldProvenance:{}}
];
P.ws().documents.push(...docs);
const sheets=context.PCAInsights.buildExportSheets();
checks.push({test:'gera oito planilhas',actual:sheets.map(s=>s.name),expected:8,ok:sheets.length===8});
const singleSheets=context.PCAInsights.buildExportSheets('doc-a');
checks.push({test:'exportação individual filtra por plano',actual:singleSheets.find(s=>s.name==='Planos').rows.length-1,expected:1,ok:singleSheets.find(s=>s.name==='Planos').rows.length===2});
const budgetRow=sheets.find(s=>s.name==='Orçamentos').rows[1];
checks.push({test:'aferição de orçamento usa teto de 30%',actual:{limit:budgetRow[3],total:budgetRow[4],status:budgetRow[5]},expected:{limit:15000,total:11200,status:'Dentro de 30%'},ok:budgetRow[3]===15000&&budgetRow[4]===11200&&budgetRow[5]==='Dentro de 30%'});
checks.push({test:'similaridade reconhece o mesmo ID do catálogo local',actual:P.sim().length,expected:'pelo menos 1 grupo',ok:P.sim().length>=1});
checks.push({test:'fórmula Excel quantidade × unitário',actual:sheets[0].rows[1][14],expected:{formula:'L2*M2',value:8400},ok:sheets[0].rows[1][14].formula==='L2*M2'&&sheets[0].rows[1][14].value===8400});
checks.push({test:'campos do catálogo vão para Excel',actual:sheets[0].rows[0].slice(-5),expected:['ID catálogo local','Descrição sugerida pelo catálogo','Unidade original do PDF','Código CATMAT/CATSER informado','Alias de catálogo correspondente'],ok:sheets[0].rows[0].slice(-5).join('|')==='ID catálogo local|Descrição sugerida pelo catálogo|Unidade original do PDF|Código CATMAT/CATSER informado|Alias de catálogo correspondente'});
const workspacePreview=context.PCAInsights.buildWorkspacePreviewTables(P.exportPayload());
const previewNames=workspacePreview.map(x=>x.name);
checks.push({test:'prévia tabular dos dados do JSON traz oito conjuntos',actual:previewNames,expected:8,ok:workspacePreview.length===8&&previewNames.includes('Proveniência dos campos')&&previewNames.includes('Arquivos de origem')});
const demandPreview=workspacePreview.find(x=>x.name==='Demandas e cálculos');
checks.push({test:'prévia tabular inclui demandas, cálculo e campos de origem',actual:demandPreview.rows[1]?.slice(9,14),expected:['300','28,00','8.400','8.400','quantidade × valor unitário'],ok:demandPreview.rows.length===3&&demandPreview.rows[1][9]==='300'&&demandPreview.rows[1][12]==='8.400'&&demandPreview.rows[1][14]==='Alta'});
const unmappedPreview=workspacePreview.find(x=>x.name==='Trechos não mapeados');
checks.push({test:'prévia do JSON exibe trechos não mapeados antes do download',actual:unmappedPreview.rows[1]?.[2],expected:'Entrega por unidade',ok:unmappedPreview.rows.length===2&&unmappedPreview.rows[1][2]==='Entrega por unidade'});
const rawPreview=workspacePreview.find(x=>x.name==='Texto bruto');
checks.push({test:'prévia tabular preserva texto bruto extraído',actual:rawPreview.rows[1]?.[3],expected:'1 Papel A4 Resma 300 28,00 8.400',ok:rawPreview.rows.length===3&&rawPreview.rows[1][3].includes('Papel A4')});
checks.push({test:'download JSON recebe nome específico para plano individual',actual:/exportJsonFilename=.*selectedDoc\?baseName:'workspace'/.test(fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8')),expected:true,ok:/exportJsonFilename=.*selectedDoc\?baseName:'workspace'/.test(fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8'))});
const planSource=fs.readFileSync(path.join(__dirname,'..','plano.js'),'utf8');
const dashboardSource=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
checks.push({test:'menu Plano consolidado usa roteador principal',actual:/nav\.addEventListener\('click',\(\)=>P\(\)\.setView\('plano'\)\)/.test(planSource),expected:true,ok:/nav\.addEventListener\('click',\(\)=>P\(\)\.setView\('plano'\)\)/.test(planSource)});
checks.push({test:'menu Dashboard usa roteador principal',actual:/nav\.addEventListener\('click',\(\)=>P\(\)\.setView\('dashboard'\)\)/.test(dashboardSource),expected:true,ok:/nav\.addEventListener\('click',\(\)=>P\(\)\.setView\('dashboard'\)\)/.test(dashboardSource)});
const bytes=context.PCAExcel.buildXlsx(sheets);
fs.writeFileSync(path.join(os.tmpdir(),'pca-lab-smoke-test.xlsx'),Buffer.from(bytes));
console.log(JSON.stringify({checks,allPassed:checks.every(x=>x.ok),xlsxBytes:bytes.length,sheetNames:sheets.map(s=>s.name)},null,2));
if(!checks.every(x=>x.ok))process.exit(1);
