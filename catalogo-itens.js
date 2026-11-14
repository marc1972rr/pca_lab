/*
 * PCA Lab — catálogo local inicial de referência.
 * Os identificadores são internos e demonstrativos; códigos CATMAT/CATSER oficiais
 * devem ser preenchidos/confirmados pela área competente antes do uso institucional.
 */
(() => {
  'use strict';
  const normalize = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9²]+/g, ' ').replace(/\s+/g, ' ').trim();

  const items = [
    { id:'LOCAL-EXP-001', codigoCatmat:'', descricaoPadrao:'Papel sulfite, formato A4 (210 × 297 mm)', categoria:'Material de expediente', unidadePadrao:'Resma', aliases:['papel a4','papel sulfite a4','papel formato a4','resma de papel a4'] },
    { id:'LOCAL-EXP-002', codigoCatmat:'', descricaoPadrao:'Caneta esferográfica, tinta azul', categoria:'Material de expediente', unidadePadrao:'Unidade', aliases:['caneta esferografica azul','caneta azul','caneta esferografica'] },
    { id:'LOCAL-EXP-003', codigoCatmat:'', descricaoPadrao:'Envelope para correspondência (especificar formato)', categoria:'Material de expediente', unidadePadrao:'Unidade', aliases:['envelope a4','envelope pardo','envelope para correspondencia','envelope ofício','envelope oficio'] },
    { id:'LOCAL-EXP-004', codigoCatmat:'', descricaoPadrao:'Pasta para acondicionamento de documentos (especificar material/formato)', categoria:'Material de expediente', unidadePadrao:'Unidade', aliases:['pasta suspensa','pasta arquivo','pasta plastica','pasta plástica'] },
    { id:'LOCAL-TI-001', codigoCatmat:'', descricaoPadrao:'Cartucho de toner para impressora (informar modelo e compatibilidade)', categoria:'Tecnologia da informação', unidadePadrao:'Unidade', aliases:['toner para impressora','cartucho de toner','toner impressora','toner'] },
    { id:'LOCAL-TI-002', codigoCatmat:'', descricaoPadrao:'Computador portátil tipo notebook (especificar configuração)', categoria:'Tecnologia da informação', unidadePadrao:'Unidade', aliases:['notebook','computador portatil','computador portátil','laptop'] },
    { id:'LOCAL-TI-003', codigoCatmat:'', descricaoPadrao:'Monitor para computador (especificar tamanho/resolução)', categoria:'Tecnologia da informação', unidadePadrao:'Unidade', aliases:['monitor led','monitor para computador','monitor'] },
    { id:'LOCAL-TI-004', codigoCatmat:'', descricaoPadrao:'Licença de uso de software (especificar solução, quantidade e vigência)', categoria:'Tecnologia da informação', unidadePadrao:'Licença', aliases:['licenca de uso','licença de uso','licenca software','licença software','assinatura de software'] },
    { id:'LOCAL-LIMP-001', codigoCatmat:'', descricaoPadrao:'Detergente para limpeza (especificar composição/apresentação)', categoria:'Material de limpeza/higiene', unidadePadrao:'Frasco', aliases:['detergente liquido','detergente líquido','detergente'] },
    { id:'LOCAL-LIMP-002', codigoCatmat:'', descricaoPadrao:'Água sanitária/solução de hipoclorito (especificar concentração/apresentação)', categoria:'Material de limpeza/higiene', unidadePadrao:'Frasco', aliases:['agua sanitaria','água sanitária','hipoclorito'] },
    { id:'LOCAL-LIMP-003', codigoCatmat:'', descricaoPadrao:'Papel toalha para higiene (especificar formato e gramatura)', categoria:'Material de limpeza/higiene', unidadePadrao:'Pacote', aliases:['papel toalha','toalha de papel'] },
    { id:'LOCAL-LIMP-004', codigoCatmat:'', descricaoPadrao:'Papel higiênico (especificar folha, metragem e apresentação)', categoria:'Material de limpeza/higiene', unidadePadrao:'Pacote', aliases:['papel higienico','papel higiênico'] },
    { id:'LOCAL-COMB-001', codigoCatmat:'', descricaoPadrao:'Gasolina automotiva (especificar tipo e local de abastecimento)', categoria:'Combustíveis e lubrificantes', unidadePadrao:'Litro', aliases:['gasolina comum','gasolina aditivada','gasolina'] },
    { id:'LOCAL-COMB-002', codigoCatmat:'', descricaoPadrao:'Óleo diesel (especificar tipo)', categoria:'Combustíveis e lubrificantes', unidadePadrao:'Litro', aliases:['oleo diesel s10','óleo diesel s10','diesel s10','oleo diesel','óleo diesel'] },
    { id:'LOCAL-AGUA-001', codigoCatmat:'', descricaoPadrao:'Água mineral em garrafão de 20 litros (recarga)', categoria:'Água e bebidas', unidadePadrao:'Recarga', aliases:['recarga de agua mineral','recarga de água mineral','agua mineral 20 litros','água mineral 20 litros'] },
    { id:'LOCAL-AGUA-002', codigoCatmat:'', descricaoPadrao:'Garrafão retornável de 20 litros para água mineral', categoria:'Água e bebidas', unidadePadrao:'Unidade', aliases:['garrafao de 20 litros','garrafão de 20 litros','garrafao completo'] },
    { id:'LOCAL-SERV-001', codigoCatmat:'', descricaoPadrao:'Serviço de manutenção preventiva/corretiva (detalhar escopo e unidade de medição)', categoria:'Serviços', unidadePadrao:'Serviço', aliases:['manutencao preventiva','manutenção preventiva','manutencao corretiva','manutenção corretiva'] },
    { id:'LOCAL-SERV-002', codigoCatmat:'', descricaoPadrao:'Serviço de limpeza e conservação (detalhar áreas, frequência e produtividade)', categoria:'Serviços', unidadePadrao:'Mês', aliases:['servico de limpeza','serviço de limpeza','limpeza e conservacao','limpeza e conservação'] },
    { id:'LOCAL-OBRA-001', codigoCatmat:'', descricaoPadrao:'Serviço/obra de reforma ou adequação predial (detalhar projeto e escopo)', categoria:'Obras e engenharia', unidadePadrao:'Serviço', aliases:['reforma predial','adequacao predial','adequação predial','obra de reforma'] }
  ].map(item => ({ ...item, aliasesNormalizados:item.aliases.map(normalize) }))
    .sort((a,b) => Math.max(...b.aliasesNormalizados.map(x=>x.length)) - Math.max(...a.aliasesNormalizados.map(x=>x.length)));

  const unitMap = new Map();
  const addUnit = (canonical, aliases) => aliases.forEach(alias=>unitMap.set(normalize(alias),canonical));
  addUnit('Unidade',['unidade','unid','unid.','und','und.','un','un.']);
  addUnit('Caixa',['caixa','caixas','cx','cx.']);
  addUnit('Pacote',['pacote','pacotes','pct','pct.','pcte']);
  addUnit('Resma',['resma','resmas']);
  addUnit('Recarga',['recarga','recargas']);
  addUnit('Frasco',['frasco','frascos']);
  addUnit('Litro',['litro','litros','l']);
  addUnit('Quilograma',['kg','quilo','quilo(s)','quilograma','quilogramas']);
  addUnit('Grama',['g','grama','gramas']);
  addUnit('Metro',['m','metro','metros']);
  addUnit('Metro quadrado',['m2','m²','metro quadrado','metros quadrados']);
  addUnit('Metro linear',['metro linear','metros lineares','m linear']);
  addUnit('Rolo',['rolo','rolos']);
  addUnit('Par',['par','pares']);
  addUnit('Kit',['kit','kits']);
  addUnit('Jogo',['jogo','jogos']);
  addUnit('Serviço',['serviço','servico','serviços','servicos']);
  addUnit('Mês',['mês','mes','meses']);
  addUnit('Hora',['hora','horas','h']);
  addUnit('Licença',['licença','licenca','licenças','licencas']);

  function find(description) {
    const text=normalize(description);
    if(!text)return null;
    for(const item of items){
      const alias=item.aliasesNormalizados.find(alias=>alias && text.includes(alias));
      if(alias)return {id:item.id,codigoCatmat:item.codigoCatmat,descricaoPadrao:item.descricaoPadrao,categoria:item.categoria,unidadePadrao:item.unidadePadrao,aliasCorrespondente:alias};
    }
    return null;
  }
  function normalizeUnit(unit) {
    const key=normalize(unit);
    return unitMap.get(key) || String(unit||'').trim();
  }

  window.PCACatalog = {
    version:'0.1-demo',
    notice:'Catálogo local demonstrativo. IDs são internos; códigos CATMAT/CATSER não foram presumidos.',
    items:items.map(({aliasesNormalizados,...item})=>item),
    find,
    normalizeUnit,
    normalizeText:normalize
  };
})();
