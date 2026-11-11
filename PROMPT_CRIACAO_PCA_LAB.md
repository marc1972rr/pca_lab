# PROMPT-MESTRE — PCA LAB
## Aplicação web local para recepção, leitura, padronização e auditoria preliminar de Planos de Contratações

> **Instrução central:** construa um produto funcional, não apenas um mockup ou uma tela demonstrativa. A aplicação deve transformar PDFs departamentais heterogêneos em dados estruturados, rastreáveis, editáveis e exportáveis, preservando integralmente o conteúdo extraído que não puder ser mapeado com segurança. A padronização jamais pode apagar, sobrescrever ou inventar a informação de origem.

---

## 1. PAPEL E OBJETIVO DO PRODUTO

Atue como uma equipe sênior composta por arquiteto de software, desenvolvedor front-end, especialista em experiência do usuário, analista de dados e profissional de planejamento de contratações públicas.

Desenvolva o **PCA Lab**, uma aplicação web moderna, responsiva e didática destinada a gestores responsáveis por receber, analisar, qualificar e consolidar planos de contratação elaborados individualmente por departamentos ou unidades requisitantes.

O sistema deverá permitir que o gestor:

1. carregue um ou vários arquivos PDF enviados pelos departamentos;
2. extraia texto e tabelas sempre que possível;
3. converta os dados identificados em campos padronizados;
4. visualize, lado a lado ou em abas, os dados estruturados, o conteúdo bruto extraído e os trechos que não foram classificados;
5. edite livremente os dados estruturados, sem modificar a fonte original;
6. classifique, promova, revise ou mantenha como informação complementar os dados que não couberem no modelo;
7. identifique ausências, inconsistências, possíveis duplicidades e demandas semelhantes entre departamentos;
8. salve automaticamente o estado de trabalho no próprio navegador;
9. exporte o workspace completo para JSON e importe esse mesmo JSON em outra sessão ou navegador, recuperando o estado de trabalho;
10. execute uma consolidação preliminar dos planos sem retirar dos departamentos a responsabilidade pela identificação e justificativa das suas necessidades.

O produto é uma ferramenta de apoio à gestão e à qualidade dos dados. **Não deve aprovar contratações, substituir análises técnicas, emitir parecer jurídico ou tomar decisões administrativas automaticamente.**

## 2. PRINCÍPIO NÃO NEGOCIÁVEL: PRESERVAÇÃO E RASTREABILIDADE

A aplicação deve manter três camadas claramente separadas:

### Camada A — Fonte original / conteúdo bruto

- Preservar o texto extraído do PDF, página por página, na ordem em que for possível reconstruí-lo.
- Guardar o nome original do arquivo, tamanho, tipo MIME, data de importação, número de páginas e método de extração.
- Preservar linhas, tabelas ou blocos de texto não reconhecidos.
- Sempre que tecnicamente viável, guardar também a referência de página e a posição aproximada do trecho no documento.
- Não reescrever, corrigir ortografia ou normalizar o texto original.
- Informar claramente que a extração textual pode não reproduzir a disposição visual do PDF, especialmente tabelas complexas, colunas e documentos digitalizados.

### Camada B — Dados padronizados / estrutura canônica

- Guardar valores normalizados em campos estáveis, com nomenclatura única.
- Cada valor extraído automaticamente precisa possuir proveniência: página, trecho de origem, método/regra de extração e grau de confiança quando disponível.
- Distinguir claramente valor sugerido automaticamente, valor confirmado pelo gestor e valor incluído manualmente.
- Permitir edição sem alterar a Camada A.
- Manter o valor originalmente sugerido para que o gestor possa comparar com o valor editado.

### Camada C — Conteúdo não mapeado / informações adicionais

- Manter todos os trechos relevantes que não tenham sido associados com segurança a um campo padronizado.
- Não descartar informações por não caberem no modelo.
- Permitir ao gestor marcar o trecho como revisado, promovê-lo a campo complementar, associá-lo a um campo padronizado ou mantê-lo como informação livre.
- Armazenar o histórico da decisão, incluindo data e tipo de alteração.

**Regra de integridade:** nenhum algoritmo poderá eliminar um trecho da fonte porque ele parece redundante, irrelevante ou semelhante a outro. A aplicação poderá sugerir agrupamentos, mas a decisão será sempre humana e rastreável.

## 3. AMBIENTE TÉCNICO E PUBLICAÇÃO

A primeira versão deve funcionar como site estático no **GitHub Pages**, sem backend obrigatório, sem banco de dados remoto e sem exigir instalação de servidor.

### Stack preferencial

- HTML5 semântico.
- CSS moderno, responsivo e organizado em componentes/utilitários.
- JavaScript moderno (ES Modules) ou TypeScript compilado para arquivos estáticos.
- PDF.js para extração local de texto e metadados do PDF.
- IndexedDB como armazenamento local principal.
- localStorage apenas como fallback para configurações ou pequenos estados, nunca como armazenamento primário de PDFs ou grandes textos.
- Service Worker e Cache API para armazenar o shell estático da aplicação e permitir reabertura offline depois da primeira visita.
- JSON como formato oficial de intercâmbio e backup do workspace.

Não introduza Python como requisito de execução, pois GitHub Pages não executa backend Python. Ferramentas de build podem ser usadas durante desenvolvimento, mas o resultado publicado deve ser estático. Dê preferência a uma implementação que possa ser aberta em servidor HTTP simples e publicada sem infraestrutura adicional.

### Bibliotecas externas

- Fixe versões de bibliotecas externas; não use URLs flutuantes como `latest`.
- Documente claramente quais bibliotecas são carregadas por CDN.
- Se a implantação exigir operação totalmente offline, disponibilize a opção de incluir os arquivos de distribuição do PDF.js no próprio repositório, respeitando as respectivas licenças.
- Não envie o PDF, seu texto, nem os dados extraídos para APIs externas por padrão.

## 4. FLUXO PRINCIPAL DO USUÁRIO

### 4.1. Recepção

- Área de upload com clique e arrastar/soltar.
- Aceitar múltiplos PDFs.
- Validar extensão, MIME type e tamanho.
- Exibir progresso por arquivo e por página.
- Criar registro individual para cada documento, mantendo vínculo com seu arquivo de origem.
- Permitir renomear o rótulo do documento sem alterar o nome original do arquivo.

### 4.2. Extração

- Usar PDF.js para percorrer todas as páginas.
- Agrupar fragmentos de texto em linhas usando coordenadas, sempre preservando a página.
- Tentar reconhecer tabelas e linhas de itens; não presumir que todas as tabelas serão reconstruídas perfeitamente.
- Detectar PDF sem camada textual e explicar que ele provavelmente exige OCR.
- Para a versão ampliada, prever OCR local opcional com Tesseract.js e idioma português (`por`), sujeito à confirmação do gestor. Não enviar o arquivo a serviços externos.
- Informar quando a extração falhar, for parcial ou apresentar baixa confiança.
- Nunca preencher dado ausente por inferência silenciosa.

### 4.3. Padronização assistida

Aplicar regras determinísticas e transparentes para sugerir campos. A aplicação deve informar a origem de cada sugestão e permitir revisão manual.

Campos mínimos do plano:

**Identificação**
- exercício de referência;
- órgão/entidade;
- Unidade Gestora (UG);
- departamento/unidade requisitante;
- responsável pela demanda;
- processo ou identificador interno;
- tipo/natureza da contratação.

**Objeto e necessidade**
- objeto resumido;
- descrição detalhada;
- justificativa/fundamentação da necessidade;
- finalidade/resultado esperado;
- categoria ou família do objeto;
- código CATMAT/CATSER, se aplicável;
- unidade de fornecimento ou medida.

**Dimensionamento**
- quantidade estimada;
- memória de cálculo;
- histórico de consumo ou contratação anterior;
- estoque disponível, quando aplicável;
- existência e vigência de contrato atual;
- local(is) de entrega ou execução;
- periodicidade/parcelamento.

**Orçamento e valor**
- valor unitário estimado;
- valor total estimado;
- valor global da demanda;
- fonte/data da estimativa;
- programa/ação;
- elemento de despesa;
- fonte de recurso;
- observações orçamentárias.

**Programação e estratégia**
- prioridade;
- justificativa da prioridade;
- mês/data desejada para contratação;
- data em que o objeto deverá estar disponível;
- dependência de outra contratação;
- contratação nova, recorrente ou renovação;
- possibilidade de agrupamento;
- estratégia sugerida de contratação, sempre como hipótese para avaliação.

Não force todos os campos a serem obrigatórios para todos os tipos de objeto. Diferencie campo obrigatório, condicional e complementar, com regras configuráveis pelo administrador.

## 5. DICIONÁRIO DE DADOS E TAXONOMIAS

Implemente um dicionário de dados centralizado, com:

- chave técnica estável;
- nome de exibição;
- descrição do significado;
- tipo de dado;
- domínio de valores permitido;
- regra de obrigatoriedade;
- validação;
- sinônimos aceitos;
- unidade de medida aplicável;
- versão do dicionário.

Implemente taxonomias configuráveis para:

- natureza do objeto: material, serviço, obra/engenharia, tecnologia da informação e outros tipos configurados;
- categorias de materiais e serviços;
- situação da demanda;
- prioridade;
- unidade de medida;
- status de revisão;
- fonte da informação (extraída, corrigida, manual, importada).

Evite manter sinônimos e categorias duplicados em código espalhado. A lista de unidades e categorias deve poder ser mantida em um arquivo JSON de configuração.

**Não confunda semelhança textual com equivalência técnica.** Papel A4 de gramaturas, formatos, embalagens ou requisitos distintos pode não ser equivalente. O sistema deve sugerir correspondências e exibir as diferenças relevantes, nunca consolidar automaticamente.

## 6. MODELO DE DADOS E JSON

Defina um schema versionado. O arquivo exportado deve conter o workspace inteiro e não somente os campos atualmente visíveis na tela.

Estrutura conceitual mínima:

```json
{
  "schema": "pca-lab-workspace/v1",
  "appVersion": "1.0.0",
  "dictionaryVersion": "1.0.0",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "exportedAt": "ISO-8601",
  "documents": [
    {
      "id": "uuid",
      "source": {
        "filename": "plano.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 12345,
        "sha256": null,
        "importedAt": "ISO-8601",
        "pageCount": 4,
        "extractionMethod": "pdfjs-text-layer"
      },
      "raw": {
        "text": "texto integral extraído",
        "pages": [
          { "page": 1, "lines": ["linha 1", "linha 2"] }
        ]
      },
      "normalized": {
        "exercise": { "value": "2027", "sourcePage": 1, "sourceText": "Exercício: 2027", "status": "confirmed" },
        "requestingDepartment": { "value": "Diretoria Administrativa", "sourcePage": 1, "sourceText": "...", "status": "suggested" }
      },
      "demands": [],
      "extraFields": [],
      "unmapped": [],
      "review": { "status": "in_review", "issues": [] },
      "activityLog": []
    }
  ]
}
```

O código acima é ilustrativo: implemente schema JSON formal, validação de tipos, campos opcionais, migrações de versões e tratamento de campos desconhecidos.

### Requisitos obrigatórios do JSON

- Exportar dados estruturados, dados brutos, páginas, trechos não mapeados, campos adicionais, estado de revisão, decisões do usuário e histórico.
- Importar o JSON exportado pelo próprio app e reconstituir a interface e o estado de trabalho.
- Validar schema, versão, integridade básica e tamanho antes da importação.
- Oferecer as opções **substituir workspace**, **acrescentar documentos** e **cancelar**.
- Detectar IDs duplicados ao acrescentar e gerar novos identificadores quando necessário, sem perder relações internas.
- Apresentar erros de importação compreensíveis, sem sobrescrever dados atuais silenciosamente.
- Incluir campos desconhecidos importados em uma área de compatibilidade, em vez de descartá-los.
- Deixar explícito se o binário do PDF original está ou não incluído na exportação. Para a primeira versão, é aceitável exportar o texto extraído e os dados, sem embutir PDFs grandes, desde que isso seja informado claramente.

## 7. TELAS E EXPERIÊNCIA DO GESTOR

Crie uma interface moderna, sofisticada e funcional, sem aparência de planilha antiga ou formulário burocrático.

### Tela A — Visão geral

- indicadores: documentos recebidos, demandas estruturadas, pendências, duplicidades potenciais e valor estimado;
- distribuição por departamento;
- status de revisão;
- evolução de documentos recebidos;
- botão principal para adicionar PDFs;
- botão para carregar dados fictícios de demonstração;
- resumo de alertas críticos e próximos passos.

### Tela B — Planos recebidos

- cards ou tabela com nome do arquivo, departamento, exercício, quantidade de itens, valor, status e data de importação;
- busca, filtros e ordenação;
- identificação clara de documento com falha de extração;
- abrir documento em um clique.

### Tela C — Análise individual do documento

Organizar o conteúdo em abas ou painéis:

1. **Dados estruturados:** campos do plano e tabela de demandas editáveis.
2. **Conteúdo bruto:** texto extraído em sua sequência original, separado por página e com busca textual.
3. **Não mapeados:** trechos não classificados, com página e contexto; permitir marcar revisado, promover a campo complementar ou associar a um campo padronizado.
4. **Auditoria:** verificações, alertas, grau de completude, origem das sugestões e histórico de modificações.
5. **Origem/visualização do PDF:** quando o PDF original estiver disponível nesta sessão, permitir visualizá-lo sem alterar a extração. Se o binário não for persistido, explicar isso.

A tabela de demandas deve permitir, no mínimo:

- número ou identificador do item;
- descrição original;
- descrição padronizada/editável;
- categoria;
- código CATMAT/CATSER;
- unidade de medida;
- quantidade;
- valor unitário;
- valor total;
- local de entrega;
- página de origem;
- status de revisão;
- observação do gestor.

Permitir inserir, duplicar, excluir e reordenar itens, sempre com confirmação para ações destrutivas relevantes. A descrição original deve continuar visível e imutável.

### Tela D — Malha fina

Exibir:

- campos obrigatórios ausentes;
- linhas com descrição, unidade ou quantidade ausente;
- possível inconsistência entre quantidade × valor unitário e valor total;
- possíveis divergências de nomenclatura;
- itens com unidade diferente;
- demandas repetidas em um mesmo plano ou em planos distintos;
- diferenças em especificações técnicas;
- incompatibilidades aparentes de classificação orçamentária;
- dados não extraídos por PDF digitalizado;
- divergência entre data de contratação e exercício planejado.

Cada alerta deve informar:

- o que foi detectado;
- por que merece atenção;
- qual documento e página estão envolvidos;
- nível de severidade;
- sugestão de providência;
- botão para abrir o ponto diretamente no documento.

### Tela E — Comparação e consolidação

- agrupar possíveis demandas semelhantes entre departamentos;
- mostrar lado a lado as descrições, categorias, quantidades, unidades, valores e especificações;
- destacar diferenças que podem impedir agrupamento;
- permitir ao gestor marcar “avaliar contratação conjunta”, “manter separado” ou “aguardar esclarecimento”;
- manter as quantidades por departamento e calcular apenas o total potencial quando unidades e especificações forem comparáveis;
- jamais consolidar, excluir ou substituir demandas automaticamente;
- registrar autor, data e justificativa de cada decisão.

### Tela F — Configurações e dicionário

- editar lista de categorias;
- editar unidades de medida;
- editar sinônimos;
- definir campos obrigatórios e condicionais;
- configurar limiares de alertas;
- visualizar versão do dicionário;
- importar/exportar configurações em JSON.

## 8. MOTOR DE VALIDAÇÃO — A “MALHA FINA”

Implemente verificações transparentes, configuráveis e separadas por dimensão:

### A. Integridade
- campos essenciais ausentes;
- formatos inválidos;
- identificadores repetidos;
- linhas sem origem rastreável;
- documento sem texto extraível.

### B. Consistência
- quantidade não numérica ou negativa;
- valores fora do formato esperado;
- valor total incompatível com quantidade × valor unitário;
- unidade inadequada ou não reconhecida;
- datas inválidas;
- conflito entre exercício e data desejada;
- descrição padronizada vazia;
- justificativa insuficiente ou ausente.

### C. Similaridade e duplicidade
- igualdade textual após normalização de acentos e espaços;
- comparação aproximada de palavras;
- sinônimos configurados;
- unidade e especificações como fatores de comparação;
- distinção explícita entre “duplicidade confirmada”, “semelhança provável” e “apenas categoria coincidente”.

### D. Orçamento
- quantidade e valores calculáveis;
- ausência de informação orçamentária quando exigida;
- elemento de despesa incompatível apenas como alerta preliminar, nunca como conclusão automática;
- soma de valores por unidade e por exercício;
- comparação com limite ou previsão informado pelo gestor, se houver.

### E. Consolidação
- oportunidades de padronização;
- potencial de compra compartilhada;
- centralização logística;
- risco de dividir objeto de forma inadequada;
- necessidade de análise de mercado e planejamento específico.

A aplicação não deve criar parecer sobre fracionamento indevido, inexigibilidade, dispensa ou legalidade de uma contratação. Pode apenas apontar situações que demandam análise especializada.

### Classificação de resultado

Adote pelo menos três resultados:

- **Apto para consolidação:** dados essenciais presentes e verificações sem pendências impeditivas configuradas.
- **Apto com ressalvas:** inconsistências que podem ser resolvidas ou justificadas durante a análise.
- **Pendente de correção:** ausência ou contradição que compromete a leitura da demanda.

A classificação deve ser baseada em regras visíveis e configuráveis, nunca em nota opaca.

## 9. EDIÇÃO, GOVERNANÇA E AUDITORIA DE ALTERAÇÕES

- Auto-save após cada alteração relevante.
- Indicador visível: salvando, salvo localmente ou falha de armazenamento.
- Histórico de atividade por documento.
- Registrar valor anterior, valor novo, data, ação e usuário/identificador local quando disponível.
- Permitir desfazer alterações recentes ou restaurar o valor originalmente extraído.
- Não apagar a fonte quando o gestor editar um campo normalizado.
- Permitir observações e justificativas nas alterações relevantes.
- Não assumir autenticação multiusuário em versão sem servidor; informar que o workspace é local ao navegador e não possui controle central de acesso.

## 10. ARMAZENAMENTO LOCAL, OFFLINE E PRIVACIDADE

- Usar IndexedDB como persistência principal.
- Utilizar Service Worker para cache dos arquivos estáticos do app.
- Reabrir o app e recuperar os dados locais depois de fechar e abrir o navegador.
- Exibir alerta de que limpar dados do site, trocar de navegador, perfil ou dispositivo pode remover o workspace.
- Oferecer exportação JSON como backup manual.
- Não utilizar localStorage para guardar documentos pesados.
- Não transferir PDFs, texto extraído ou dados administrativos para servidores ou APIs externas.
- Informar que a biblioteca PDF.js pode ser carregada de CDN e que, nesse caso, o navegador faz uma requisição para obter a biblioteca, mas o conteúdo do PDF permanece processado localmente.
- Para operação totalmente desconectada, permitir hospedar PDF.js e seu worker no próprio repositório.
- Implementar limites de tamanho, tratamento de quota excedida e mensagens de recuperação.
- Não incluir dados reais nos exemplos e screenshots de demonstração.

## 11. DESIGN E ACESSIBILIDADE

Direção visual: **painel institucional contemporâneo, clean, confiável e acolhedor**, com acabamento de produto SaaS profissional.

- hierarquia visual evidente;
- navegação lateral no desktop e navegação adaptada no celular;
- cartões de indicadores sem excesso de cores;
- paleta sóbria com azul profundo, azul claro, cinza neutro e verde discreto para confirmação;
- âmbar para revisão e vermelho apenas para erros críticos;
- tipografia legível e espaçamento generoso;
- microinterações discretas, estados vazios úteis, skeletons e feedback de salvamento;
- gráficos apenas quando ajudarem a análise;
- tabelas responsivas com rolagem horizontal em telas estreitas;
- contraste adequado, foco visível, labels associados aos inputs e navegação por teclado;
- nenhuma ação importante pode depender apenas de cor;
- textos e tooltips em português do Brasil, linguagem simples e institucional.

Evite excesso de gradientes, efeitos decorativos, animações pesadas, jargões técnicos na interface e qualquer visual que esconda a fonte original dos dados.

## 12. SEGURANÇA E QUALIDADE DE IMPLEMENTAÇÃO

- Escapar conteúdo extraído antes de inserir em HTML; não confiar no texto do PDF.
- Evitar `innerHTML` com dados sem sanitização.
- Não executar scripts, links ou anexos contidos em documentos.
- Validar arquivos e JSON de entrada.
- Tratar PDFs malformados, protegidos por senha, vazios ou excessivamente grandes.
- Nunca registrar conteúdo sensível do PDF em logs de console.
- Manter dependências fixadas e documentadas.
- Separar módulos: ingestão PDF, extração, normalização, validação, persistência, importação/exportação e interface.
- Desenvolver testes unitários para regras de normalização, cálculos, validação e migração de JSON.
- Criar arquivos fictícios de teste para PDFs textuais e PDF digitalizado.
- Garantir que o estado atual possa ser exportado mesmo após falha parcial em outra etapa.

## 13. CRITÉRIOS DE ACEITAÇÃO — NÃO CONSIDERE CONCLUÍDO SEM ELES

1. Um gestor consegue adicionar um PDF textual e obter texto extraído por página.
2. O app tenta identificar metadados e linhas de demanda sem afirmar que a extração é infalível.
3. Cada campo sugerido tem rastreabilidade até a fonte ou é identificado como preenchimento manual.
4. O gestor consegue editar os dados estruturados sem modificar o texto bruto.
5. Trechos não classificados permanecem acessíveis e podem ser revisados ou promovidos a campos adicionais.
6. A aplicação identifica campos ausentes e inconsistências aritméticas configuradas.
7. O gestor consegue incluir uma demanda manualmente.
8. O app identifica possíveis demandas semelhantes entre departamentos, sem consolidá-las automaticamente.
9. O estado de trabalho persiste ao fechar e reabrir o navegador na mesma origem/perfil.
10. Exportar JSON e importar esse mesmo arquivo reconstitui documentos, alterações, texto bruto, campos extras e decisões de revisão.
11. A importação oferece substituir, acrescentar ou cancelar e trata IDs duplicados.
12. O shell do app abre offline após ter sido armazenado em cache; limitações de bibliotecas CDN devem ser informadas.
13. O app funciona publicado em GitHub Pages, inclusive em URL com subcaminho de repositório; não use caminhos absolutos que quebrem o deploy.
14. Em viewport móvel, nenhuma função essencial fica inacessível.
15. A interface informa claramente que a leitura automática é preliminar e exige revisão humana.

## 14. ENTREGÁVEIS

Entregue:

- código-fonte completo;
- estrutura de pastas pronta para GitHub Pages;
- README com instalação, publicação, limitações e privacidade;
- prompt/documentação de arquitetura;
- schema JSON versionado e um JSON de exemplo fictício;
- demonstração que possa ser carregada sem PDF real;
- instruções para hospedar localmente em servidor HTTP simples;
- instruções para publicar em GitHub Pages;
- checklist de testes manuais;
- nenhuma dependência obrigatória de servidor, banco remoto ou conta externa.

## 15. POSTURA DE DESENVOLVIMENTO

Se uma informação não puder ser extraída com segurança, deixe o campo vazio e mostre o trecho em “Não mapeados”. Não invente dados, não complete quantidades, não suponha unidade de medida, não transforme uma semelhança em equivalência técnica e não silencie divergências.

A prioridade do produto é **confiabilidade, transparência, rastreabilidade, facilidade de revisão e preservação da autonomia do gestor** — não a quantidade de campos preenchidos automaticamente.

Construa primeiro um MVP robusto com extração textual, normalização assistida, revisão, persistência local, JSON e malha fina. Depois evolua para OCR local, catálogo institucional, comparações mais sofisticadas e fluxos multiusuário com backend, sem comprometer os princípios acima.
