# PCA Lab 0.3.0

Protótipo estático para receber planos setoriais em PDF, preservar a fonte, estruturar demandas, permitir revisão gerencial e apoiar a consolidação dos dados de planejamento.

## Iniciar localmente

O projeto não precisa de backend nem de instalação de dependências npm. É necessário servir os arquivos por HTTP para habilitar IndexedDB e Service Worker:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador.

Também pode ser publicado diretamente no GitHub Pages: envie todos os arquivos e pastas deste pacote para a raiz (ou para a pasta configurada como origem do Pages) e habilite Pages nas configurações do repositório. Os caminhos são relativos para permitir publicação em subdiretório.

## Funcionalidades desta versão

- Recepção de múltiplos PDFs por seleção ou arrastar e soltar.
- Extração da camada textual usando PDF.js e agrupamento heurístico de linhas.
- OCR experimental em português sob demanda para documentos sem camada textual, utilizando Tesseract.js.
- Campos padronizados e itens editáveis, preservando descrição, unidade, linha e página de origem.
- Sugestões de um catálogo local demonstrativo, com aliases, categorias e unidades canônicas. IDs `LOCAL-*` são identificadores internos; não são códigos CATMAT/CATSER oficiais.
- Cálculo vinculado em tempo real: quantidade × valor unitário = valor total calculado. A interface explica a relação entre os campos; o total transcrito do PDF ou digitado manualmente é preservado e comparado, com opção explícita de aplicar o cálculo quando houver divergência.
- Proveniência básica de campos e itens, histórico de alterações e revisão individual.
- Aba de conteúdo bruto, trechos não classificados e verificações preliminares.
- Comparação textual aproximada entre demandas, como sugestão para análise do gestor.
- Dashboard com indicadores, distribuição das demandas, revisão, categorias, valores e integridade dos documentos.
- Central de exportação com três modos: prévia das planilhas Excel, prévia tabular dos dados estruturados que integram o JSON e visualização do JSON técnico; tabelas paginadas com todas as linhas navegáveis. Exportação abrange o workspace ou somente o plano aberto.
- Exportação `.xlsx` sem biblioteca externa, com oito abas: `PCA Consolidado`, `Orçamentos`, `Planos`, `Não Mapeados`, `Campos Extras`, `Auditoria`, `Histórico` e `Texto Bruto`.
- Fórmula Excel na coluna de valor calculado, congelamento do cabeçalho, filtros e formatação básica.
- Exportação/importação JSON do workspace; o PDF original é incluído no JSON apenas quando sua preservação foi possível.
- Persistência local via IndexedDB, com fallback em localStorage.
- PWA/Service Worker para cache do shell estático e cache em runtime das dependências externas após carregamento online.

## Atualizações da versão 0.3.0

- Incluída uma terceira aba na central de exportação: **Dados completos · tabela**, para conferir dentro do aplicativo os dados organizados que compõem o JSON, antes de baixar.
- A prévia tabular contempla metadados, demandas, campos complementares, proveniência, trechos não mapeados, texto bruto, histórico e arquivos de origem.
- A exportação JSON de um plano individual agora recebe nome próprio, em vez de nomear o arquivo como se fosse o workspace inteiro.
- A interface explicita o cálculo automático e deixa mais claro quando um total manual diverge do valor calculado.
- Cache do Service Worker atualizado para impedir que versões antigas da interface permaneçam ativas.

## Estrutura dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura da aplicação e ordem dos módulos |
| `styles.css` | Identidade visual geral e componentes compartilhados |
| `plano.css` | Plano consolidado, dashboard, catálogo e prévia de exportação |
| `app.js` | Estado, armazenamento, PDF, OCR, extração heurística, edição, auditoria e JSON |
| `plano.js` | Tabela de consolidação, filtros, decisões, agrupamento e aferição preliminar de orçamento |
| `dashboard.js` | Dashboard, prévias e organização dos dados para exportação |
| `xlsx-export.js` | Geração local do arquivo Open XML `.xlsx` |
| `catalogo-itens.js` | Catálogo demonstrativo e normalização de unidades |
| `sw.js` | Cache de shell e cache runtime de dependências externas |
| `manifest.webmanifest` | Metadados de instalação PWA |
| `assets/` | Ícones do aplicativo |

## Regras e cautelas importantes

1. A extração é heurística. O sistema não presume que uma linha foi interpretada corretamente: é indispensável conferir os dados com o PDF original.
2. O catálogo local oferece sugestões, não substitui especificação técnica, pesquisa de mercado nem consulta a catálogo oficial. Não preenche código CATMAT/CATSER oficial; esses campos são exportados apenas se forem informados por um responsável.
3. O reconhecimento de tabelas com múltiplas colunas, células mescladas ou layouts irregulares ainda pode falhar. A versão atual tenta recompor descrições em várias linhas, mas não é um extrator universal de tabelas PDF.
4. OCR depende de recursos Tesseract.js e dados de idioma em CDN na primeira utilização. O Service Worker tenta armazenar esses recursos após uma carga online, mas não há garantia de primeiro uso completamente offline.
5. PDF.js também é carregado de CDN e fica sujeito à disponibilidade da conexão na primeira visita. Depois que os recursos foram carregados/cacheados, o leitor pode funcionar offline enquanto os recursos estiverem no cache.
6. O binário PDF original é preservado no IndexedDB somente para arquivos de até 15 MB. Arquivos maiores ainda podem ter o texto extraído, mas o binário não é guardado pelo protótipo. O JSON pode ficar grande quando contém PDFs.
7. Os dados permanecem no perfil do navegador e podem ser apagados pelo usuário, por políticas do navegador ou por falta de espaço. Exporte cópias JSON regularmente. Não há sincronização entre computadores, autenticação, perfis institucionais nem colaboração multiusuário.
8. O histórico local é uma trilha auxiliar, não uma trilha formal inviolável de auditoria, pois o próprio usuário pode alterar os dados locais ou o JSON exportado.
9. A aferição de 30% é um alerta preliminar implementado para agrupar por Unidade Gestora e exercício. Exige orçamento informado e consistente. Deve ser confirmada pela área competente diante das normas e orientações vigentes; não constitui validação orçamentária formal.
10. A comparação de demandas usa similaridade lexical aproximada (tokens), não IA semântica. Toda sugestão de agrupamento depende de análise de especificação, unidade, qualidade, logística, mercado e estratégia de contratação.
11. A situação “sem apontamentos automáticos” significa apenas que as regras implementadas não encontraram os alertas configurados. Não significa aprovação ou conformidade.

## Recomendações de uso

- Comece por `Carregar exemplo` para explorar as telas e exportações.
- Teste primeiro com cópias anonimizadas de alguns PDFs representativos: PDFs textuais, tabelas multipágina e PDFs digitalizados.
- Verifique a extração de descrição, unidade, quantidade, valor unitário e total antes de usar a planilha gerada.
- Utilize o catálogo como sugestão e confirme os atributos técnicos; não consolide itens apenas por semelhança de nome.
- Exporte JSON como cópia de trabalho antes de qualquer atualização ou limpeza do navegador.

## Escopo

Esta versão é uma demonstração local para validação de fluxo, interface e estrutura de dados. Não substitui sistemas oficiais, procedimentos de contratação, avaliação técnica, validação orçamentária, parecer jurídico ou decisão da autoridade competente.

## Teste técnico rápido (opcional)

Com Node.js 18 ou superior, execute:

```bash
node tests/smoke-test.cjs
```

O teste valida parsing de valores brasileiros, catálogo local, cálculos, invalidação de revisão após edição, agrupamento por ID do catálogo, regra de 30%, planilhas e fórmula XLSX. O arquivo de teste é gerado no diretório temporário do sistema.
