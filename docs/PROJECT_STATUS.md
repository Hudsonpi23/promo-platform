# 📋 PROMO PLATFORM — STATUS COMPLETO DO PROJETO

> Atualizado em: 28/03/2026  
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
| `customPhrases.ts` | `/api/custom-phrases` | Frases personalizadas |
| `niches.ts` | `/api/niches` | Nichos |
| `config.ts` | `/api/config` | Config do sistema |
| `videoPublish.ts` | `/api/video` | Publicação de vídeo |

### Endpoints importantes implementados/modificados:
- `GET /api/twitter/preview/:offerId?paymentMethod=&installments=&installmentValue=&phraseMode=` — Preview real do tweet
- `POST /api/twitter/post` — Post livre com `{ text, imageUrl? }`
- `POST /api/twitter/post-offer/:offerId` — Post de oferta com `{ customText?, paymentMethod, installments, installmentValue, phraseMode }`
- `POST /api/telegram/message` — Mensagem livre com `{ text, imageUrl? }`
- `POST /api/upload/base64` — Upload de imagem base64 → Cloudinary

---

## 🧠 SERVIÇOS PRINCIPAIS (`packages/api/src/services/`)

| Arquivo | Função |
|---------|--------|
| `aiCopyGenerator.ts` | **CORE** — Geração de copy para X, Telegram, Site |
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
   - Solução: resolver o redirect chain até a URL real do produto
2. **Integração multi-plataforma** — Shopee e outras além de ML e Amazon
3. **Página de vídeos local** — Remotion + Whisper rodando localmente
   - Fase 1: carrosséis estáticos para Instagram
   - Fase 2: vídeos curtos automatizados
   - Fase 3: agente IA completo com Whisper

---

## 🎯 ESTRATÉGIA DO CANAL

- **Nome do canal**: Manu das Promoções
- **Plataformas**: X (principal), Telegram, Instagram (futuro)
- **Meta de seguidores**: 200.000
- **Posts diários atuais**: ~70
- **Posts meta**: 250/dia (promoções + interação + métricas)
- **Afiliados ativos**: Mercado Livre, Amazon, Shopee
- **Filosofia**: sempre o menor preço real, independente da % de comissão

---

## 🔄 COMO ATUALIZAR ESTE ARQUIVO

Ao final de cada sessão de implementação, atualize as seções:
- **✅ IMPLEMENTAÇÕES REALIZADAS** — adicione o que foi feito
- **⏳ PENDÊNCIAS** — remova o que foi concluído, adicione novas tarefas
- **Altere a data** no topo do arquivo
