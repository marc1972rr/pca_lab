# Changelog

## 0.3.0 — 2026-11-14

### Melhorias entregues
- Central de exportação com três visualizações: planilhas Excel, dados completos em forma de tabela e JSON técnico.
- Prévia tabular dos elementos que compõem o JSON: planos/metadados, demandas/cálculos, campos complementares, proveniência, trechos não mapeados, texto bruto, histórico e arquivos de origem.
- Navegação paginada e seletor de conjunto de dados na prévia do JSON.
- Exportação JSON de plano individual com nome de arquivo correspondente ao plano selecionado.
- Explicação mais explícita dos campos vinculados e do recálculo automático; divergências de totais manuais ficam mais claras.
- Cache do shell atualizado para a versão 0.3.0.

## 0.2.0 — 2026-11-13

### Adicionado
- Dashboard gerencial com indicadores de planos, demandas, valores, distribuição, prioridades, categorias, revisão e integridade.
- Central de exportação com alternância entre Excel e JSON.
- Exportação do workspace completo ou do plano individual aberto.
- Pré-visualização paginada de todas as linhas das oito abas exportáveis.
- Geração de arquivo `.xlsx` local, sem dependência de biblioteca externa.
- Fórmula de cálculo em Excel para quantidade × valor unitário, com recálculo automático ao abrir a planilha.
- Catálogo local demonstrativo de objetos, aliases e unidades padronizadas, com opção explícita de aplicar a sugestão.
- OCR experimental em português para PDFs sem camada textual.
- Preservação do PDF original no IndexedDB para arquivos de até 15 MB.
- Proveniência de dados e unidade original registrada ao lado da unidade normalizada.

### Corrigido / reforçado
- Reconstituição do `app.js` a partir da versão sintaticamente íntegra e integração com `plano.js` e `dashboard.js`, evitando escapes literais do arquivo colado.
- Regra de alerta orçamentário alterada para 30% do orçamento, agrupada por Unidade Gestora e exercício.
- Situações sem orçamento, sem UG, sem exercício ou com orçamentos divergentes passaram a ser “não aferidas” ou divergentes, sem sinalização positiva automática.
- Removida a opção de marcar todos os itens filtrados como revisados; revisão é individual.
- Comparação de demandas aprimorada com similaridade lexical por tokens e verificação de compatibilidade de unidade.
- Importação JSON com validação de esquema, limites de tamanho de campos, identificadores e referências de PDF.
- Service Worker atualizado para cachear `plano.css`, `dashboard.js`, `xlsx-export.js`, catálogo e ícones; versão de cache elevada para invalidar shells antigos.
- Navegação dinâmica do Dashboard e do Plano Consolidado conectada ao roteador central.

### Limitações conhecidas
- Extração de tabela ainda heurística; OCR e reconhecimento de layout exigem validação com documentos reais.
- PDF.js e Tesseract são carregados por CDN, com cache em runtime depois da primeira conexão.
- Similaridade é lexical aproximada, não semântica por modelo de IA.
- Catálogo contém IDs internos demonstrativos, sem códigos CATMAT/CATSER oficiais presumidos.
- Persistência e histórico são locais ao navegador; não há autenticação ou colaboração multiusuário.
