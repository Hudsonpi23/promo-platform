# 📋 PROMO PLATFORM — STATUS COMPLETO DO PROJETO

> Atualizado em: 29/03/2026  
> Leia este arquivo no início de cada nova conversa para ter o contexto completo.

---

## 🏗️ ARQUITETURA

### Monorepo (npm workspaces + Turbo)
```
promo-platform/
├── apps/
│   ├── platform/     ← Painel admin (Next.js 14, porta 3004, deploy: Vercel)
│   └── site/         ← Site público (Next.js 14, porta 3003, deploy: Vercel)
├── packages/
│   ├── api/          ← Backend (Fastify + Prisma, porta 3001, deploy: Render)
│   └── shared/       ← Tipos e utilitários compartilhados
└── docs/             ← Esta pasta de documentação
```

### Deploy
- **Frontend admin**: `https://promo-platform-admin.vercel.app`
- **Site público**: `https://manu-promocoes.vercel.app` / `www.manu-promocoes.com.br`
- **API**: `https://promo-platform-api.onrender.com`
- **Banco de dados**: PostgreSQL no Neon (`ep-quiet-night-acs3zt4n-pooler.sa-east-1.aws.neon.tech`)

---

## 📄 PÁGINAS DO PAINEL ADMIN (`apps/platform/app/`)

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `page.tsx` | Home do admin |
| `/login` | `login/page.tsx` | Login JWT |
| `/ofertas` | `ofertas/page.tsx` | Gestão de ofertas — principal |
| `/criar-post` | `criar-post/page.tsx` | **NOVO** Editor universal de posts |
| `/avisos` | `avisos/page.tsx` | **NOVO** Post livre, enquete, métricas |
| `/performance` | `performance/page.tsx` | **NOVO** Dashboard de performance |
| `/auto-publicar` | `auto-publicar/page.tsx` | Auto publicação em lote |
| `/metrics` | `metrics/page.tsx` | Métricas do canal |
| `/videos` | `videos/page.tsx` | Vídeos |
| `/historico` | `historico/page.tsx` | Histórico de publicações |
| `/erros` | `erros/page.tsx` | Logs de erro |
| `/execucoes` | `execucoes/page.tsx` | Execuções do scheduler |
| `/cargas` | `cargas/page.tsx` | Batches/cargas |
| `/config` | `config/page.tsx` | Configurações |
| `/telegram-interativo` | `telegram-interativo/page.tsx` | **NOVO** Posts interativos Telegram (mensagem, enquete, sorteio, quiz, gerador IA) |
| `/manual/[channel]` | `manual/[channel]/page.tsx` | Modo manual por canal |

---

## 🔌 ROTAS DA API (`packages/api/src/routes/`)

| Arquivo | Prefixo | Descrição |
|---------|---------|-----------|
| `auth.ts` | `/auth` | Login/JWT |
| `offers.ts` | `/api/offers` | CRUD de ofertas |
| `twitter.ts` | `/api/twitter` | Postagem no X/Twitter |
| `telegram.ts` | `/api/telegram` | Bot Telegram |
| `facebook.ts` | `/api/facebook` | Meta/Facebook |
| `upload.ts` | `/api/upload` | Upload Cloudinary |
| `scraper.ts` | `/api/scraper` | Scraping de produtos |
| `autoPublish.ts` | `/api/auto-publish` | Pipeline automático |
| `imageSearch.ts` | `/api` | Busca de imagens |
| `metrics.ts` | `/api/metrics` | Métricas agregadas |
| `publications.ts` | `/api/publications` | Publicações |
| `drafts.ts` | `/api/drafts` | Rascunhos |
| `scheduler.ts` | `/api/scheduler` | Agendamento |
| `affiliates.ts` | `/api/affiliates` | Afiliados |
| `mlAuth.ts` | sem prefixo | OAuth Mercado Livre |
| `aiWorkflow.ts` | `/api/ai` | Workflow IA + endpoint `/generate-text` |
| `amazon.ts` | `/api/amazon` | **NOVO** Amazon Creators API (busca, produto por URL/ASIN) |
| `twitterMetrics.ts` | `/api/twitter-metrics` | **NOVO** Métricas do X (timeline, perfil, menções, performance) |
| `customPhrases.ts` | `/api/custom-phrases` | Frases personalizadas |
| `niches.ts` | `/api/niches` | Nichos |
| `config.ts` | `/api/config` | Config do sistema |
| `videoPublish.ts` | `/api/video` | Publicação de vídeo |

### Endpoints importantes implementados/modificados:
- `GET /api/twitter/preview/:offerId?paymentMethod=&installments=&installmentValue=&phraseMode=` — Preview real do tweet
- `POST /api/twitter/post` — Post livre com `{ text, imageUrl? }`
- `POST /api/twitter/post-offer/:offerId` — Post de oferta com `{ customText?, paymentMethod, installments, installmentValue, phraseMode }`
- `POST /api/telegram/message` — Mensagem livre com `{ text, imageUrl? }`
- `POST /api/telegram/poll` — **NOVO** Enquete nativa do Telegram com `{ question, options[], isAnonymous?, allowsMultipleAnswers? }`
- `POST /api/ai/generate-text` — **NOVO** Gerar texto livre via IA com `{ prompt, maxTokens? }`
- `POST /api/amazon/search` — **NOVO** Busca produtos Amazon por keyword
- `POST /api/amazon/get-items` — **NOVO** Busca por ASIN(s)
- `POST /api/amazon/product-from-url` — **NOVO** Extrai produto de URL Amazon via API
- `GET /api/twitter-metrics/profile` — **NOVO** Dados do perfil (seguidores, tweets)
- `GET /api/twitter-metrics/timeline` — **NOVO** Timeline com métricas (views, likes, replies)
- `GET /api/twitter-metrics/performance` — **NOVO** Resumo de performance (top posts, médias)
- `GET /api/twitter-metrics/mentions` — **NOVO** Menções ao @manupromocao
- `GET /api/twitter-metrics/search` — **NOVO** Busca tweets recentes (7 dias)
- `POST /api/twitter-metrics/tweets` — **NOVO** Métricas de tweets por IDs
- `POST /api/upload/base64` — Upload de imagem base64 → Cloudinary

---

## 🧠 SERVIÇOS PRINCIPAIS (`packages/api/src/services/`)

| Arquivo | Função |
|---------|--------|
| `aiCopyGenerator.ts` | **CORE** — Geração de copy factual (título, preço, link). Frases criativas delegadas aos agentes IA |
| `amazonApi.ts` | **NOVO** — Amazon Creators API v3 (busca, preços, imagens, afiliado) |
| `twitterMetrics.ts` | **NOVO** — Leitura de métricas do X via API v2 Pay-Per-Use |
| `twitter.ts` | Cliente X API (upload mídia, postagem) |
| `telegram.ts` | Cliente Telegram (texto + imagem) |
| `cloudinary.ts` | Upload/gestão de imagens |
| `mlScraper.ts` | Scraping Mercado Livre |
| `mlAffiliate.ts` | Afiliados ML |
| `channelScheduler.ts` | Agendamento por canal |
| `phrases/` | Banco de frases por nicho (20+ arquivos) |

---

## ✅ IMPLEMENTAÇÕES REALIZADAS (histórico completo)

### Formato dos posts (X/Twitter)
- ✅ Preço final sempre prevalece (não o preço original) no modo parcelado
- ✅ Modo PIX: `por R$ X` + `🔥 -X% DE DESCONTO NO PIX`
- ✅ Modo Parcelado: `De R$ X / por R$ X / À vista ou Nx de R$ Y`
- ✅ Modo À vista: `De R$ X / por R$ X`
- ✅ Hook OFERTA RELÂMPAGO fixo: `⚡⚡⚡ OFERTA RELÂMPAGO ⚡⚡⚡`
- ✅ Urgência relâmpago apenas no topo: `⏰ CORRE TEMPO LIMITADO!`
- ✅ Frase do produto inserida entre urgência e título (modo relâmpago)
- ✅ Frases sempre em MAIÚSCULAS

### Preview do post
- ✅ Preview usa endpoint real do servidor (texto exato que será postado)
- ✅ Parâmetros de preview: `paymentMethod`, `installments`, `installmentValue`, `phraseMode`
- ✅ Botão **🔄 Nova Frase** — gera frase diferente sem fechar modal
- ✅ Botão **✏️ Editar** — modo edição direta no modal (textarea livre, sem maxLength bloqueante, autoFocus)
- ✅ Botão **✅ Aplicar Edição** — salva texto editado e volta ao preview
- ✅ Confirmar e Postar usa `customText` (texto exato do preview, não regera)
- ✅ Contador de chars: verde ≤240, amarelo 240-280, vermelho >280

### Detecção de produtos (`aiCopyGenerator.ts`)
- ✅ Fix: "fraldas adulto" não mais categorizado como roupa
- ✅ Fix: "pijama" em título de livro não ativa detector de roupa
  - `pijama` genérico removido; agora requer `pijama feminino/masculino/adulto/etc.`
- ✅ Detector de livros reforçado: `tapa mole`, `tapa dura`, `editorial`, `john boyne`, `anne frank`, etc.
- ✅ Novos detectores: Cabo Lightning, Cubo Mágico, Pokémon TCG, Torneira

### Novas frases por produto
- ✅ `cabo lightning` — 8 frases específicas (`eletronicos.ts`)
- ✅ `cubo mágico` — 5 frases (`games.ts`)
- ✅ `pokemon tcg` — 5 frases (`games.ts`)
- ✅ `torneira` — 5 frases (`casa.ts`)

### Página de Ofertas (`/ofertas`)
- ✅ Filtro por nicho
- ✅ Preview real do post antes de publicar
- ✅ Indicador de qualidade (🔥 Quente / ✅ Boa / ⚠️ Fraca)
- ✅ Link para histórico de publicações por oferta

### Nova página: Performance (`/performance`)
- ✅ KPIs: total ofertas, publicações, nunca publicadas, desconto médio
- ✅ Métricas por canal (X, Telegram, Site)
- ✅ Top 5 mais publicadas
- ✅ Top 5 maiores descontos
- ✅ Oportunidades (alto desconto, nunca publicadas)

### Nova página: Avisos (`/avisos`)
- ✅ Aba Post Livre: texto livre para X e Telegram
- ✅ Aba Enquete: pergunta + até 4 opções + preview
- ✅ Aba Métricas: publicar resumo de métricas no X e Telegram

### Nova página: Criar Post (`/criar-post`) — MAIS RECENTE
- ✅ Seletor de tipo: Aviso, Sorteio, Quiz, Agradecimento, Cupom, Pergunta, Métricas, Outro
- ✅ Editor de texto grande
- ✅ **Emoji picker** com 6 categorias: Hype, Dinheiro, Expressões, Avisos, Tempo, Números
  - Insere emoji na posição do cursor
- ✅ **Upload de imagem** — drag & drop ou clique, vai para Cloudinary
- ✅ **Templates prontos** por tipo de post
- ✅ **Preview em tempo real** lado a lado:
  - Card visual estilo X (fundo preto)
  - Card visual estilo Telegram (fundo azul escuro)
- ✅ Botões: Postar no Telegram + Postar no X (ambos suportam imagem)
- ✅ Contador de chars X vs Telegram

### Nova página: Posts Interativos Telegram (`/telegram-interativo`) — 29/03/2026
- ✅ 5 abas: Mensagem, Enquete, Sorteio, Quiz, Gerador IA
- ✅ **Aba Mensagem**: texto livre com mensagens rápidas pré-definidas (bom dia, agradecimento, novidade, etc.)
- ✅ **Aba Enquete**: enquete nativa do Telegram com botões clicáveis (2-4 opções, anônimo, múltipla escolha)
  - Sugestões de enquetes prontas para engajamento
  - Usa `POST /api/telegram/poll` (endpoint novo — `sendPoll` da API Telegram)
- ✅ **Aba Sorteio**: templates prontos para sorteio PIX, sorteio produto e resultado
- ✅ **Aba Quiz**: perguntas interativas de engajamento com templates prontos
- ✅ **Aba Gerador IA**: gera posts criativos automaticamente usando `POST /api/ai/generate-text`
  - Prompts sugeridos por tipo: promoção do dia, engajamento, bom dia, agradecimento
  - Usa OpenAI com persona da Manu (tom informal, emojis, envolvente)
- ✅ Preview em tempo real de cada post
- ✅ Envio direto ao Telegram com feedback de sucesso/erro
- ✅ Link no menu lateral do admin (`LayoutContent.tsx`)

### Refatoração do aiCopyGenerator.ts — 29/03/2026
- ✅ **Removidas ~2.600 linhas** de frases pré-feitas (openings, urgências, detectores de produto, etc.)
- ✅ Versão limpa: gera apenas texto factual (título, preço, desconto, link)
- ✅ Personalidade e frases criativas ficam a cargo dos agentes IA (Manu, Theo)
- ✅ Agentes decidem tom, frase e estilo no momento da publicação — adaptação ao contexto em tempo real

### Novo endpoint: Geração de texto via IA
- ✅ `POST /api/ai/generate-text` — gera texto criativo com prompt livre
- ✅ Usa `createCompletion` do serviço de IA com persona da Manu
- ✅ Retorna texto + contagem de tokens

### Novo endpoint: Enquete nativa Telegram
- ✅ `POST /api/telegram/poll` — envia enquete com botões clicáveis
- ✅ Validação: mínimo 2, máximo 10 opções
- ✅ Suporta: anônimo, múltiplas respostas

### Token Mercado Livre — Auto-refresh
- ✅ Implementado ciclo de refresh automático do access token do ML
- ✅ Token armazenado em memória no servidor (não depende de variável de ambiente manual)
- ✅ Refresh a cada ~6h antes da expiração
- ✅ Logs de renovação no servidor

### Conta da Manu Orquestradora na plataforma
- ✅ Criado usuário dedicado para a Manu Orquestradora acessar a Promo Platform
- ✅ Login via JWT com acesso completo (ADMIN)
- ✅ Manu Orquestradora consegue usar a plataforma via API para buscar e postar promoções

### Treinamento da Manu Orquestradora
- ✅ Guia completo criado com todas as páginas e funcionalidades da plataforma
- ✅ Fluxo A (Auto-Publish) e Fluxo B (Nova Oferta) documentados
- ✅ Regras de afiliados: ML (API), Amazon (?tag=manudaspromoc-20), Shopee (futura)
- ✅ Manu executou posts reais via Promo Platform (X e Telegram)

### Amazon Creators API — Integração completa — 29/03/2026
- ✅ SDK `amazon-creators-api` instalado (TypeScript)
- ✅ Serviço `amazonApi.ts` com autenticação OAuth 2.0 (Login with Amazon v3.x)
- ✅ `searchAmazonProducts()` — busca por keyword com filtros (preço, sort, categoria)
- ✅ `getAmazonItems()` — busca por ASIN(s) com imagens, preços, OffersV2, avaliações
- ✅ `getAmazonProductByUrl()` — extrai ASIN da URL e consulta API
- ✅ Rotas: `/api/amazon/search`, `/api/amazon/get-items`, `/api/amazon/product-from-url`
- ✅ Integrado com scraper existente — Amazon usa API primeiro, fallback para HTTP scraping
- ✅ Integrado com autoPublish — sem mais CAPTCHA!
- ✅ Credenciais via variáveis de ambiente no Render (5 vars)
- ✅ Dados retornados: título, preço, desconto, imagens (primary + variants), features, rating, reviews, disponibilidade, link de afiliado

### X API Metrics — Leitura completa — 29/03/2026
- ✅ Serviço `twitterMetrics.ts` com OAuth 1.0a (mesmas credenciais do posting)
- ✅ `getMyProfile()` — seguidores, following, total tweets, verificado
- ✅ `getMyTimeline()` — últimos tweets com métricas (impressions, likes, replies, retweets, quotes, bookmarks)
- ✅ `getTweetMetrics()` — métricas de tweets específicos por IDs
- ✅ `getMyMentions()` — quem mencionou @manupromocao
- ✅ `searchRecentTweets()` — busca de tweets nos últimos 7 dias
- ✅ `getPerformanceSummary()` — top posts por impressões/likes/replies, médias gerais
- ✅ Rotas: `/api/twitter-metrics/profile`, `/timeline`, `/performance`, `/mentions`, `/search`, `/tweets`
- ✅ Paginação completa com nextToken
- ✅ Custo: ~$0.005 por leitura (Pay-Per-Use)

### OpenClaw — Configuração de browser
- ✅ Browser config atualizada: `cdpUrl`, `attachOnly: true`, profile `chrome`
- ✅ Skills instaladas: `browser-use-api`, `browser-automation-ultra`, Playwright
- ✅ Diagnóstico: localhost VPS ≠ localhost Windows → solução: rodar Chromium no VPS
- ✅ Script Playwright proposto para capturar métricas do X sem browser tool

### Backend — suporte a imagem em posts livres
- ✅ `POST /api/twitter/post` aceita `imageUrl` opcional
- ✅ `POST /api/telegram/message` aceita `imageUrl` opcional

---

## 🔧 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

### API (Render)
```env
DATABASE_URL=postgresql://...neon.tech/...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
ML_ACCESS_TOKEN=...
ML_REFRESH_TOKEN=...
OPENAI_API_KEY=...
SERPAPI_KEY=...
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...
AMAZON_CREDENTIAL_ID=amzn1.application-oa2-client.xxx
AMAZON_CREDENTIAL_SECRET=amzn1.oa2-cs.v1.xxx
AMAZON_CREDENTIAL_VERSION=3.1
AMAZON_PARTNER_TAG=manudaspromoc-20
AMAZON_MARKETPLACE=www.amazon.com.br
```

### Frontends (Vercel)
```env
NEXT_PUBLIC_API_URL=https://promo-platform-api.onrender.com
NEXT_PUBLIC_SITE_URL=https://manu-promocoes.vercel.app
```

---

## 📦 BANCO DE DADOS

- **Provider**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Schema**: `packages/api/prisma/schema.prisma`
- **Modelos principais**: `User`, `Offer`, `Niche`, `Store`, `PostDraft`, `PostDelivery`, `PublishedPost`, `OfferPublication`, `PostHistory`, `CustomPhrase`, `AffiliateAccount`, `MercadoLivreAccount`

---

## ⏳ PENDÊNCIAS (a implementar)

1. **Links curtos do ML** — `meli.la` redireciona para página social do ML, plataforma não lê produto
2. **Integração Shopee** — estudar API da Shopee ou alternativa para incluir na plataforma

### Agentes IA (OpenClaw na VPS)
3. **Criar agente Manu X** — postar, responder, threads, trending no Twitter/X
4. **~~Criar agente Manu Telegram~~** — ✅ Soul + Estratégia definidos (ver `docs/MANU_TELEGRAM_SOUL.md`). Falta: criar no OpenClaw e ativar.
5. **Criar agente Manu Instagram** — carrosséis, reels, stories, hashtags
6. **Criar agente Manu WhatsApp** — comunicação direta, atendimento
7. **Conectar agentes com as APIs** — X API, Telegram Bot, Instagram API, WhatsApp Business API
8. **Adicionar skills/habilidades** a cada agente conforme regras de cada rede social

### Browser do OpenClaw no VPS
9. **Rodar Chromium no VPS** — instalar e configurar Chromium headless direto na Hostinger para que o OpenClaw use `localhost:9222` corretamente
10. **Configurar Playwright no VPS** — script de captura de métricas do X (views, likes, replies por post)
11. **Testar browser-use-api** — configurar `BROWSER_USE_API_KEY` para usar browser cloud ($0.06/h)

### Smart-Publish (proposta da Manu Orquestradora)
12. **Endpoint unificado `/api/smart-publish`** — combinar scrape + afiliado + imagem + copy + publicação multicanal em um único endpoint
13. **Fallback automático de imagem** — lifestyle → scraper → texto (sem decisão manual)
14. **Descoberta autônoma de produtos** — agente buscar promoções sozinho (Amazon/ML) sem receber URL

### Página de vídeos/carrosséis
15. **Instalar Remotion** na plataforma (local) para gerar vídeos e carrosséis
    - Fase 1: carrosséis estáticos para Instagram
    - Fase 2: vídeos curtos automatizados com Remotion
    - Fase 3: legendas automáticas com Whisper

### X API — Métricas avançadas
16. ~~**Upgrade para X API Basic**~~ — ✅ Desnecessário! Pay-Per-Use ($5/mês) já dá acesso a métricas
    - Implementado: leitura de timeline, perfil, menções, performance via API v2

---

## 🤖 SISTEMA DE AGENTES (VPS Hostinger)

### Infraestrutura
- **VPS**: Hostinger KVM 4, Ubuntu 24.04 LTS, 8GB RAM, 4 vCPU, 200GB disco
- **IP**: 187.127.1.208
- **OpenClaw**: Docker container rodando na porta 56487
- **HTTPS**: Nginx reverse proxy com certificado auto-assinado (porta 443)
- **Acesso**: https://187.127.1.208

### Agentes configurados
| Agente | Função | Status |
|--------|--------|--------|
| Manu Orquestradora | Coordenação, métricas, relatórios semanais | ✅ Operacional + acesso à Promo Platform |
| Manu X | Postar e interagir no Twitter/X | ⏳ A criar |
| Manu Telegram (Theo) | Postar promoções, curar ofertas, FAQ, reportar métricas | 🟡 Soul + Estratégia prontos |
| Manu Instagram | Carrosséis, reels, stories | ⏳ A criar |
| Manu WhatsApp | Comunicação direta | ⏳ A criar |

### Skills instaladas no OpenClaw
| Skill | Função | Status |
|-------|--------|--------|
| browser-use-api | Navegação visual com IA (browser cloud) | ✅ Instalada, falta `BROWSER_USE_API_KEY` |
| browser-automation-ultra | Automação Playwright com sessão reutilizada | ✅ Instalada |
| Agent Browser | Browser automation genérico | ❌ Bloqueada por segurança |

### Automações ativas
- Relatório semanal automático: sexta às 18h (America/Sao_Paulo)
- Envio via Telegram para chat ID: 7114228848
- Sistema de score semanal (0-100) por canal
- Memória persistente com baseline e histórico
- Auto-refresh do token Mercado Livre (a cada ~6h)

### Modelo de IA
- GPT-5.4 (flagship) para todos os agentes

---

## 🎯 ESTRATÉGIA DO CANAL

- **Nome do canal**: Manu das Promoções
- **Site**: www.manu-promocoes.com.br
- **Plataformas**: X (principal), Telegram, Instagram (futuro), WhatsApp (futuro)
- **X handle**: @manupromocao
- **Baseline (março/2026)**: X ~100 seguidores, Telegram ~130 inscritos, Instagram 0
- **Posts diários atuais**: ~70
- **Receita mensal atual**: ~R$500
- **Afiliados ativos**: Mercado Livre (API), Amazon (Creators API + tag=manudaspromoc-20), Shopee (futuro — sem API ainda)
- **Meta 30 dias**: X 300-600 seguidores, Telegram 250-500 inscritos
- **Meta anual**: X 100.000, Telegram 20.000, Instagram 20.000
- **Meta receita**: R$10.000+/mês
- **Filosofia**: sempre o menor preço real, independente da % de comissão

---

## 🔄 COMO ATUALIZAR ESTE ARQUIVO

Ao final de cada sessão de implementação, atualize as seções:
- **✅ IMPLEMENTAÇÕES REALIZADAS** — adicione o que foi feito
- **⏳ PENDÊNCIAS** — remova o que foi concluído, adicione novas tarefas
- **Altere a data** no topo do arquivo
