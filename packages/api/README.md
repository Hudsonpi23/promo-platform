# API - Promo Platform

Backend completo em **Fastify + Prisma + PostgreSQL** para a plataforma de promoções.

## 🚀 Quick Start

### 1. Instalar dependências
```bash
cd packages/api
npm install
```

### 2. Configurar ambiente
Crie um arquivo `.env` baseado no exemplo:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/promo_platform?schema=public"
JWT_SECRET="sua-chave-secreta-aqui"
PORT=3001
SITE_BASE_URL="http://localhost:3003"
```

### 3. Criar banco e rodar migrations
```bash
npm run db:push
# ou
npx prisma migrate dev
```

### 4. Popular com dados de exemplo
```bash
npm run db:seed
```

### 5. Iniciar servidor
```bash
npm run dev
```

A API estará disponível em `http://localhost:3001`

---

## 📚 Endpoints

### Auth
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/login` | Login com email/senha |
| POST | `/auth/refresh` | Renovar token |
| POST | `/auth/logout` | Logout (revoga refresh token) |
| GET | `/auth/me` | Dados do usuário logado |

### Config
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/config` | Obter configurações |
| PUT | `/api/config` | Atualizar configurações |
| GET | `/api/config/cargas` | Listar schedules de carga |
| PUT | `/api/config/cargas` | Atualizar schedules |

### Niches
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/niches` | Listar nichos |
| POST | `/api/niches` | Criar nicho |
| PUT | `/api/niches/:id` | Atualizar nicho |
| DELETE | `/api/niches/:id` | Desativar nicho |

### Stores
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stores` | Listar lojas |
| POST | `/api/stores` | Criar loja |
| PUT | `/api/stores/:id` | Atualizar loja |
| DELETE | `/api/stores/:id` | Desativar loja |

### Offers
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/offers` | Listar ofertas |
| POST | `/api/offers` | Criar oferta |
| GET | `/api/offers/:id` | Detalhe da oferta |
| PUT | `/api/offers/:id` | Atualizar oferta |
| POST | `/api/offers/:id/archive` | Arquivar oferta |

### Batches (Cargas)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/batches?date=YYYY-MM-DD` | Listar cargas do dia |
| POST | `/api/batches/generate` | Gerar cargas do dia |
| GET | `/api/batches/:id` | Detalhe da carga |
| POST | `/api/batches/:id/lock` | Bloquear carga |
| POST | `/api/batches/:id/close` | Fechar carga |
| POST | `/api/batches/:id/dispatch-approved` | Disparar aprovados |

### Drafts (Cards)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/drafts` | Listar drafts |
| POST | `/api/drafts` | Criar draft |
| GET | `/api/drafts/:id` | Detalhe do draft |
| PUT | `/api/drafts/:id` | Editar draft |
| POST | `/api/drafts/:id/approve` | Aprovar draft |
| POST | `/api/drafts/:id/mark-approved` | Apenas marcar aprovado |
| POST | `/api/drafts/:id/reject` | Rejeitar draft |
| POST | `/api/drafts/:id/error` | Mover para erros |
| POST | `/api/drafts/:id/dispatch` | Disparar draft |

### Publications
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/publications` | Listar publicações |
| POST | `/api/publications` | Criar publicação |
| GET | `/api/publications/:slug` | Detalhe |
| POST | `/api/publications/:id/unpublish` | Despublicar |

### Stats
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats/overview` | Visão geral |
| GET | `/api/stats/by-channel` | Stats por canal |
| GET | `/api/stats/by-niche` | Stats por nicho |
| GET | `/api/stats/by-store` | Stats por loja |
| GET | `/api/stats/clicks` | Listar cliques |

### Tracking (Público)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/go/:code` | Redirect com tracking |

### API Pública (Site)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/public/feed` | Feed de ofertas |
| GET | `/public/posts` | Listar posts |
| GET | `/public/posts/:id` | Detalhe do post |
| POST | `/public/posts/:id/click` | Registrar clique |
| GET | `/public/niches` | Listar nichos |
| GET | `/public/niches/:slug/posts` | Posts por nicho |
| GET | `/public/highlights` | Destaques |

---

## 🔐 Autenticação

Todas as rotas `/api/*` requerem autenticação JWT.

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.dev","password":"admin123"}'
```

Response:
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "abc123...",
    "user": { "id": "...", "name": "Admin", "role": "ADMIN" }
  }
}
```

### Usar token
```bash
curl http://localhost:3001/api/offers \
  -H "Authorization: Bearer eyJ..."
```

---

## 📊 Fluxo Completo

### 1. Login
```bash
# Login
POST /auth/login
{ "email": "admin@local.dev", "password": "admin123" }
```

### 2. Criar Oferta
```bash
POST /api/offers
{
  "title": "Produto X",
  "originalPrice": 199.90,
  "finalPrice": 99.90,
  "discountPct": 50,
  "affiliateUrl": "https://...",
  "nicheId": "...",
  "storeId": "..."
}
```

### 3. Gerar Cargas
```bash
POST /api/batches/generate?date=2024-01-20
```

### 4. Criar Draft
```bash
POST /api/drafts
{
  "offerId": "...",
  "batchId": "...",
  "copyText": "🔥 Oferta imperdível!",
  "channels": ["TELEGRAM", "SITE"],
  "priority": "HIGH"
}
```

### 5. Aprovar Draft
```bash
POST /api/drafts/:id/approve
```

### 6. Disparar
```bash
POST /api/drafts/:id/dispatch
# ou disparar todos da carga
POST /api/batches/:id/dispatch-approved
```

### 7. Publicar no Site
```bash
POST /api/publications
{ "offerId": "..." }
```

### 8. Tracking
Usuário acessa `/go/abc123` → registra clique → redireciona para loja

---

## 🗄️ Modelos Prisma

- `User` - Usuários (Admin/Operator)
- `RefreshToken` - Tokens de refresh
- `Config` - Configurações globais
- `BatchSchedule` - Horários das cargas
- `Niche` - Categorias de produtos
- `Store` - Lojas parceiras
- `Offer` - Ofertas/produtos
- `Batch` - Cargas (lotes de posts)
- `PostDraft` - Rascunhos (cards do painel)
- `PostDelivery` - Entregas por canal
- `PublishedPost` - Posts publicados no site
- `Click` - Tracking de cliques

---

## 🛠️ Scripts

```bash
npm run dev          # Inicia servidor em modo dev
npm run build        # Compila TypeScript
npm run start        # Inicia em produção
npm run db:generate  # Gera cliente Prisma
npm run db:push      # Aplica schema no banco
npm run db:migrate   # Roda migrations
npm run db:seed      # Popula banco com dados de exemplo
npm run db:studio    # Abre Prisma Studio
npm run db:reset     # Reseta banco (CUIDADO!)
```

---

## 👤 Credenciais de Teste

| Usuário | Email | Senha | Role |
|---------|-------|-------|------|
| Admin | admin@local.dev | admin123 | ADMIN |
| Operador | operador@local.dev | operator123 | OPERATOR |
