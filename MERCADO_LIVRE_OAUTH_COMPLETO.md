# ✅ Integração OAuth Mercado Livre - COMPLETA

## 📦 Commit: `e837ee2`

## 🚀 Deploy Status

Deploy disparado automaticamente no Render.
**Aguarde ~3-4 minutos** para o deploy completar.

Acompanhe: https://dashboard.render.com/web/srv-d5nrh45actks73cmr8b0

---

## 📂 Arquivos Criados/Modificados

### ✅ 1. `packages/api/src/lib/mercadolivre.ts`
**Biblioteca de gerenciamento de tokens OAuth**

Funções implementadas:
- `getMlConnection()` - Busca conexão ativa do ML no banco
- `isExpired(expiresAt, safetySeconds)` - Verifica se token está expirado (com margem)
- `refreshMlToken(connection)` - Renova access_token usando refresh_token
- `getValidMlAccessToken()` - Garante token válido (renova automaticamente se necessário)
- `mlApiRequest(endpoint, options)` - Wrapper para chamadas autenticadas à API ML

**Características:**
- ✅ Renovação automática de tokens
- ✅ Margem de segurança de 60s para evitar expiração durante requests
- ✅ Atualiza `expiresAt`, `lastRefreshAt`, `lastUsedAt` no banco
- ✅ Marca conta como `isActive: false` se renovação falhar
- ✅ Nunca loga tokens em console

---

### ✅ 2. `packages/api/src/routes/ml.ts`
**Rotas de teste e validação**

#### `GET /api/ml/connection`
Retorna status da conexão **SEM expor tokens**

**Resposta:**
```json
{
  "connected": true,
  "mlUserId": "123456789",
  "mlNickname": "Usuario ML",
  "mlEmail": "usuario@example.com",
  "isActive": true,
  "expiresAt": "2026-01-21T02:30:00.000Z",
  "expiresIn": 3456,
  "isExpiringSoon": false,
  "lastUsedAt": "2026-01-20T20:00:00.000Z",
  "lastRefreshAt": "2026-01-20T19:00:00.000Z"
}
```

#### `GET /api/ml/me`
Teste de vida - busca dados do usuário no ML

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": 123456789,
    "nickname": "Usuario ML",
    "email": "usuario@example.com",
    "first_name": "Usuario",
    "last_name": "Teste",
    "country_id": "BR",
    "site_id": "MLB",
    "seller_reputation": { ... },
    "buyer_reputation": { ... }
  },
  "_meta": {
    "mlUserId": "123456789",
    "tokenExpiresAt": "2026-01-21T02:30:00.000Z"
  }
}
```

✅ **Renova token automaticamente se expirado**

#### `GET /api/ml/search?query=iphone`
Busca produtos no Mercado Livre

**Query params:**
- `query` (required): Termo de busca
- `limit` (optional): Limite de resultados (padrão: 10, máx: 50)
- `offset` (optional): Offset para paginação (padrão: 0)

**Resposta:**
```json
{
  "success": true,
  "query": "iphone",
  "total": 1543,
  "limit": 10,
  "offset": 0,
  "items": [
    {
      "id": "MLB123456789",
      "title": "iPhone 15 Pro Max 256gb",
      "price": 7899.90,
      "original_price": 9999.90,
      "currency_id": "BRL",
      "available_quantity": 5,
      "sold_quantity": 120,
      "condition": "new",
      "thumbnail": "https://...",
      "permalink": "https://...",
      "seller": {
        "id": 123456,
        "nickname": "Loja Oficial"
      },
      "shipping": {
        "free_shipping": true
      }
    }
  ]
}
```

✅ **Usa token válido com renovação automática**

---

### ✅ 3. `packages/api/src/index.ts`
**Registrar novas rotas**

```typescript
import { mlRoutes } from './routes/ml';
// ...
server.register(mlRoutes, { prefix: '/api/ml' });
```

---

### ✅ 4. `packages/api/requests.http`
**Arquivo de testes HTTP completo**

Exemplos de todos os endpoints:
- Health checks
- Auth (login JWT)
- Mercado Livre OAuth
- **Mercado Livre - Testes (NOVOS) ✅**
- Niches, Stores, Offers
- Batches, Drafts, Publications
- Upload, Public routes, Stats

**Como usar:**
1. Abra no VSCode
2. Instale extensão "REST Client"
3. Clique em "Send Request" acima de cada endpoint

---

### ✅ 5. `README.md`
**Documentação atualizada**

Adicionado:
- Seção "Mercado Livre - OAuth" nos endpoints
- Seção "Mercado Livre - Testes e Validação"
- Nova seção "🧪 Testando Integração Mercado Livre" com passo a passo completo

---

## 🧪 CHECKLIST DE VALIDAÇÃO

### 1️⃣ Executar OAuth (conectar conta)

**Abrir no navegador:**
```
https://promo-platform-api.onrender.com/api/auth/mercadolivre/login
```

✅ Deve redirecionar para ML → autorizar → voltar com `?ml=connected&status=success`

---

### 2️⃣ Verificar status da conexão

```bash
GET https://promo-platform-api.onrender.com/api/ml/connection
```

**Esperado:**
- ✅ `connected: true`
- ✅ `mlUserId` presente
- ✅ `expiresAt` presente
- ✅ `expiresIn` em segundos
- ✅ **NUNCA retornar `accessToken` ou `refreshToken`**

---

### 3️⃣ Teste de vida (dados do usuário)

```bash
GET https://promo-platform-api.onrender.com/api/ml/me
```

**Esperado:**
- ✅ `success: true`
- ✅ Dados do usuário: `nickname`, `email`, `country_id`
- ✅ Reputação: `seller_reputation`, `buyer_reputation`

---

### 4️⃣ Buscar produtos

```bash
GET https://promo-platform-api.onrender.com/api/ml/search?query=iphone
GET https://promo-platform-api.onrender.com/api/ml/search?query=notebook&limit=20
```

**Esperado:**
- ✅ `success: true`
- ✅ `items[]` com lista de produtos
- ✅ Cada item com: `id`, `title`, `price`, `thumbnail`, `permalink`, `seller`
- ✅ `total`, `limit`, `offset` para paginação

---

### 5️⃣ Testar renovação automática

**Forçar expiração no banco:**

```sql
UPDATE "MercadoLivreAccount" 
SET "expiresAt" = NOW() - INTERVAL '1 hour' 
WHERE "isActive" = true;
```

**Executar novamente:**
```bash
GET https://promo-platform-api.onrender.com/api/ml/me
```

**Esperado:**
- ✅ Sistema renova token automaticamente
- ✅ Log no console: "🔄 Renovando token ML..."
- ✅ Log no console: "✅ Token ML renovado com sucesso..."
- ✅ Request funciona normalmente
- ✅ Banco atualizado com novo `expiresAt` e `lastRefreshAt`

---

## 📊 Schema do Banco (já existe)

```prisma
model MercadoLivreAccount {
  id            String   @id @default(cuid())
  
  userId        String?
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  mlUserId      String   @unique
  mlNickname    String?
  mlEmail       String?
  
  accessToken   String   @db.Text
  refreshToken  String   @db.Text
  tokenType     String   @default("Bearer")
  expiresAt     DateTime
  scope         String?
  
  isActive      Boolean  @default(true)
  lastUsedAt    DateTime?
  lastRefreshAt DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([mlUserId])
  @@index([userId])
}
```

✅ Migration já aplicada no deploy anterior

---

## 🔐 Segurança

- ✅ Tokens **NUNCA** são retornados nos endpoints de consulta
- ✅ Tokens **NUNCA** são logados no console
- ✅ Tokens ficam apenas no banco (PostgreSQL criptografado no Neon)
- ✅ Endpoint `/api/ml/connection` retorna apenas metadados

---

## 📝 Próximos Passos (OPCIONAL)

Após validar que tudo funciona:

1. **Integrar com o provider de coleta:**
   - Usar `mlApiRequest()` no `packages/api/src/providers/mercadolivre/client.ts`
   - Trocar mock por chamadas reais

2. **Criar endpoint de importação:**
   - `POST /api/sources/mercadolivre/import?query=smartphone`
   - Busca produtos → valida → cria ofertas + drafts

3. **Automatizar coleta:**
   - Worker que roda a cada X horas
   - Usa keywords do `ProviderConfig`

---

## ✅ PRONTO PARA TESTAR!

**Aguarde o deploy completar (~3-4 min) e execute o checklist acima.**

Use o arquivo `packages/api/requests.http` para testar rapidamente!

---

## 📞 Se der erro

1. Verifique logs do Render: https://dashboard.render.com/web/srv-d5nrh45actks73cmr8b0
2. Verifique tabela no banco: `SELECT * FROM "MercadoLivreAccount" WHERE "isActive" = true;`
3. Verifique variáveis de ambiente no Render:
   - `ML_CLIENT_ID`
   - `ML_CLIENT_SECRET`
   - `ML_REDIRECT_URI`
   - `DATABASE_URL`

---

## 🎉 RESUMO

### Arquivos Criados:
1. ✅ `packages/api/src/lib/mercadolivre.ts` (199 linhas)
2. ✅ `packages/api/src/routes/ml.ts` (238 linhas)

### Arquivos Modificados:
1. ✅ `packages/api/src/index.ts` (+ 2 linhas)
2. ✅ `packages/api/requests.http` (completo)
3. ✅ `README.md` (+ seção de testes)

### Funcionalidades:
1. ✅ Gerenciamento automático de tokens OAuth
2. ✅ Renovação automática com margem de segurança
3. ✅ Endpoints de teste e validação
4. ✅ Documentação completa
5. ✅ Checklist de validação

### Segurança:
1. ✅ Tokens nunca expostos em endpoints
2. ✅ Tokens nunca logados
3. ✅ Persistência segura no banco

---

**Commit:** `e837ee2`  
**Deploy:** Automático via GitHub → Render  
**Status:** ✅ COMPLETO
