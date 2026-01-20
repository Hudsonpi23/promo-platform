# Promo Platform

Sistema de automação de promoções para afiliados.

> **Status:** ✅ MVP Completo

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATAFORMA (Privada)                     │
│                        🧠 CÉREBRO                           │
├─────────────────────────────────────────────────────────────┤
│  apps/platform    → Painel do operador (Next.js)           │
│  packages/api     → API REST + Workers (Fastify)           │
│  workers/         → IAs Python (coleta/validação)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CANAIS DE SAÍDA                          │
├─────────────────────────────────────────────────────────────┤
│  📱 Telegram    │  💬 WhatsApp   │  👤 Facebook            │
│  🌐 Site Público (apps/site)                                │
└─────────────────────────────────────────────────────────────┘
```

## Estrutura do Projeto

```
promo-platform/
├── apps/
│   ├── platform/     # Painel do operador (porta 3000)
│   └── site/         # Site público vitrine (porta 3002)
├── packages/
│   ├── api/          # Backend API (porta 3001)
│   └── shared/       # Tipos compartilhados
└── workers/          # IAs Python
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Python 3.10+ (para workers de IA)

## Instalação

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar banco de dados:**
```bash
# Criar arquivo .env em packages/api/
DATABASE_URL="postgresql://user:password@localhost:5432/promo_platform"
REDIS_URL="redis://localhost:6379"
```

3. **Rodar migrações:**
```bash
cd packages/api
npx prisma db push
npx prisma generate
```

4. **Iniciar os serviços:**
```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Painel
npm run dev:platform

# Terminal 3 - Site
npm run dev:site
```

## URLs

- **Painel do Operador:** http://localhost:3000
- **API:** http://localhost:3001
- **Site Público:** http://localhost:3002

## Fluxo de Operação

1. **IA cria PostDraft** → Vai para o banco
2. **Painel exibe Cards** → Operador revisa
3. **Operador clica OK** → Post é aprovado
4. **Sistema dispara** → Envia para todos os canais
5. **Se erro** → Vai para Setor de Erros

## Sistema de Cargas

| Horário | Carga |
|---------|-------|
| 08:00   | Manhã |
| 11:00   | Meio-dia |
| 14:00   | Tarde |
| 18:00   | Fim de tarde |
| 22:00   | Noite |

## Componente Card

```
┌─────────────────────────────────────────┐
│ [Nicho]                      [Loja]     │
├─────────────────────────────────────────┤
│  Título do Produto                      │
│  R$ 2.499 → R$ 1.999  -20% OFF          │
│  ⚡ ACABA HOJE                          │
├─────────────────────────────────────────┤
│  Preview do texto...                    │
├─────────────────────────────────────────┤
│ [TG] [WA] [FB] [Site]    Carga: 14:00   │
├─────────────────────────────────────────┤
│  [✅ OK]  [✏️]  [❌]  [🧯]              │
└─────────────────────────────────────────┘
```

## API Endpoints

### Drafts (Posts pendentes)
- `GET /api/drafts` - Listar drafts
- `PATCH /api/drafts/:id` - Editar draft
- `POST /api/drafts/:id/approve` - Aprovar e enviar
- `POST /api/drafts/:id/reject` - Reprovar
- `POST /api/drafts/:id/error` - Enviar para erros

### Batches (Cargas)
- `GET /api/batches` - Listar cargas do dia
- `POST /api/batches/:id/dispatch-approved` - Disparar todos aprovados

### Ofertas
- `GET /api/offers` - Listar ofertas
- `POST /api/offers` - Criar oferta
- `POST /api/offers/:id/create-draft` - Criar draft de oferta

### Mercado Livre - OAuth
- `GET /api/auth/mercadolivre/login` - Iniciar fluxo OAuth (PKCE)
- `GET /api/auth/mercadolivre/callback` - Callback OAuth
- `GET /api/auth/mercadolivre/status` - Status da conta conectada
- `DELETE /api/auth/mercadolivre/disconnect` - Desconectar conta

### Mercado Livre - Testes e Validação ✅
- `GET /api/ml/connection` - Ver status da conexão (sem expor tokens)
- `GET /api/ml/me` - Buscar dados do usuário ML (teste de vida)
- `GET /api/ml/search?query=X` - Buscar produtos no ML

> **Renovação automática de tokens:** Os endpoints `/api/ml/*` renovam o `access_token` automaticamente quando ele expira, usando o `refresh_token` salvo no banco.

### Público (Site)
- `GET /public/posts` - Posts publicados
- `GET /public/niches` - Nichos ativos
- `POST /public/posts/:id/click` - Tracking de clique

## Tecnologias

- **Frontend:** Next.js 14, Tailwind CSS
- **Backend:** Fastify, Prisma, BullMQ
- **Banco:** PostgreSQL
- **Filas:** Redis
- **IAs:** Python, OpenAI API

## Páginas Disponíveis

### Painel do Operador (http://localhost:3000)
- `/` - Dashboard principal com grid de cards
- `/cargas` - Gerenciamento de cargas por horário
- `/ofertas` - Cadastro e gestão de ofertas
- `/erros` - Setor de erros para revisão
- `/config` - Configurações de canais, nichos e lojas

### Site Público (http://localhost:3002)
- `/` - Home com ofertas em destaque
- `/nicho/[slug]` - Ofertas filtradas por nicho
- `/oferta/[slug]` - Página individual da oferta

## Workers de Disparo

| Worker | Status | Descrição |
|--------|--------|-----------|
| Telegram | ✅ | Bot API para canais |
| WhatsApp | ✅ | Evolution API |
| Facebook | ✅ | Graph API para páginas |
| Site | ✅ | Publicação no site público |

## Pacotes

| Pacote | Descrição |
|--------|-----------|
| `apps/platform` | Painel do operador (Next.js) |
| `apps/site` | Site público vitrine (Next.js) |
| `packages/api` | Backend REST + Workers (Fastify) |
| `packages/shared` | Tipos e utilitários compartilhados |
| `workers/` | Workers Python (IAs de coleta/validação/publicação) |

## Workers Python (IAs)

| Worker | Descrição |
|--------|-----------|
| `collector/` | IA Coletora - busca ofertas na Lomadee API |
| `validator/` | IA Validadora - verifica descontos e classifica |
| `publisher/` | IA Publicadora - gera copy com OpenAI |

### Executar Workers Python

```bash
cd workers
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Executar pipeline completo
python main.py pipeline

# Executar com scheduler (produção)
python main.py scheduler
```

## 🧪 Testando Integração Mercado Livre

### 1️⃣ Conectar conta ML (OAuth)

Abra no navegador:
```
https://promo-platform-api.onrender.com/api/auth/mercadolivre/login
```
ou localmente:
```
http://localhost:3001/api/auth/mercadolivre/login
```

✅ Você será redirecionado para o ML → autorizar → voltar com sucesso

### 2️⃣ Verificar conexão

```bash
GET /api/ml/connection
```

✅ Deve retornar: `connected: true`, `mlUserId`, `expiresAt`, sem expor tokens

### 3️⃣ Teste de vida (dados do usuário)

```bash
GET /api/ml/me
```

✅ Deve retornar: `nickname`, `email`, `country_id`, `seller_reputation`

### 4️⃣ Buscar produtos

```bash
GET /api/ml/search?query=iphone
GET /api/ml/search?query=notebook&limit=20
```

✅ Deve retornar: lista de produtos com preços, fotos, sellers

### 5️⃣ Testar renovação automática

No banco, mude `expiresAt` da tabela `MercadoLivreAccount` para uma data passada:

```sql
UPDATE "MercadoLivreAccount" 
SET "expiresAt" = NOW() - INTERVAL '1 hour' 
WHERE "isActive" = true;
```

Execute novamente:
```bash
GET /api/ml/me
```

✅ O sistema deve renovar o token automaticamente e continuar funcionando

### 📄 Arquivo de Testes

Use o arquivo `packages/api/requests.http` para testar todos os endpoints rapidamente no VSCode (extensão REST Client).
