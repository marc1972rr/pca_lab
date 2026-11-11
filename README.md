# PCA Lab — protótipo de planejamento de contratações

Aplicação demonstrativa estática para receber PDFs de planos departamentais, extrair texto no navegador, sugerir campos padronizados, preservar trechos não classificados e permitir revisão humana.

## O que já funciona nesta demonstração

- Upload de um ou vários PDFs, inclusive por arrastar e soltar.
- Extração de texto por página com PDF.js (para PDFs que possuem camada textual).
- Sugestão heurística de metadados e linhas de itens.
- Edição dos dados do plano e dos itens, mantendo a descrição original visível.
- Visualização do texto bruto extraído por página.
- Área de trechos não mapeados, com opção de promover para campo complementar ou marcar como revisado.
- Auditoria preliminar de campos ausentes e cálculos simples.
- Identificação de descrições repetidas/semelhantes entre documentos.
- Salvamento local com IndexedDB e fallback básico em localStorage.
- Exportação do workspace completo para JSON e importação posterior, com opção de acrescentar ou substituir.
- Service Worker para cache do shell estático do app.
- Dados fictícios de demonstração por meio do botão **Carregar exemplo**.

## Como testar localmente

Não abra `index.html` diretamente pelo protocolo `file://`, pois o Service Worker e alguns recursos do navegador exigem HTTP/HTTPS.

Com Python instalado, na pasta `pca-lab`, execute:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador.

Também é possível usar a extensão Live Server do VS Code.

## Como publicar no GitHub Pages

1. Crie um repositório GitHub e envie todos os arquivos desta pasta para a raiz do repositório.
2. Acesse **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch principal e a pasta `/ (root)`.
5. Salve e aguarde a publicação do Pages.

Os caminhos utilizados são relativos para permitir publicação tanto na raiz quanto em `https://usuario.github.io/nome-do-repositorio/`.

## Privacidade e armazenamento

Os PDFs são lidos no próprio navegador. O texto extraído e as alterações ficam no IndexedDB do navegador, na origem do site. O conteúdo do PDF não é enviado a um backend pela aplicação.

O protótipo carrega a biblioteca PDF.js e seu worker por CDN. Isso significa que o navegador precisa obter esses arquivos externos para realizar a leitura de novos PDFs, especialmente na primeira utilização. O Service Worker guarda o shell estático (HTML, CSS e JavaScript do app), mas esta demonstração não empacota PDF.js localmente. Para operação totalmente desconectada, coloque os arquivos de distribuição do PDF.js e do worker no repositório e ajuste as referências no `index.html` e em `app.js`.

Os dados persistidos são locais ao navegador/perfil e podem ser apagados ao limpar os dados do site, trocar de dispositivo ou usar outro perfil. **Exporte regularmente o JSON como backup.** O JSON inclui o texto extraído, os dados estruturados e os campos complementares, mas não incorpora o binário original do PDF. Guarde os PDFs originais no repositório institucional apropriado.

## Limitações conhecidas

- A extração é heurística e não usa inteligência artificial generativa.
- PDFs digitalizados como imagem não são submetidos a OCR nesta versão; o sistema sinaliza a ausência de camada textual.
- Tabelas com colunas complexas, células mescladas, múltiplas linhas ou descrição quebrada podem exigir correção manual.
- A identificação de semelhanças é uma sugestão textual, não uma análise técnica definitiva de equivalência.
- Não há login, colaboração multiusuário, integração com SEI, PNCP, CATMAT/CATSER ou sistemas orçamentários.
- A auditoria é preliminar e não emite conclusões jurídicas nem substitui a validação do setor competente.

## Arquivos

- `index.html` — estrutura da interface.
- `styles.css` — identidade visual e responsividade.
- `app.js` — leitura, normalização, revisão, armazenamento e JSON.
- `sw.js` — cache do shell estático.
- `manifest.webmanifest` — metadados de instalação da aplicação.
- `PROMPT_CRIACAO_PCA_LAB.md` — prompt mestre para orientar uma versão mais completa.

## Recomendação para evolução

Antes de uso institucional, evoluir para: testes com amostras reais anonimizadas; OCR local opcional para PDFs digitalizados; schema JSON formal com migrações; catálogo institucional de itens/unidades/sinônimos; extração com confiança e proveniência por campo; e, se houver necessidade de trabalho conjunto, uma arquitetura com backend, autenticação, controle de acesso e trilha de auditoria centralizada.
