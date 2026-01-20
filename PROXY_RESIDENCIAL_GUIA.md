# 🌐 Proxy Residencial - Guia Completo

## 🎯 SOLUÇÃO 1 — PROXY RESIDENCIAL (RECOMENDADA)

### Por que Proxy Residencial?

O Mercado Livre bloqueia requisições de:
- ❌ IPs de datacenters (AWS, Render, Vercel)
- ❌ User-Agents suspeitos
- ❌ Padrões de tráfego robótico

✅ **Proxy Residencial = IP de usuário real brasileiro**

O ML libera porque parece tráfego legítimo!

---

## 🏗️ ARQUITETURA

```
┌──────────────────────────────────────────────────────────┐
│  SUA API (Render)                                        │
│  └─ GET /api/ml/public-search?query=iphone               │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│  PROXY RESIDENCIAL (Brasil)                              │
│  └─ IP residencial real (ex: Vivo, Claro, NET)           │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│  MERCADO LIVRE API                                       │
│  └─ https://api.mercadolibre.com/sites/MLB/search        │
│     ✅ LIBERADO (IP brasileiro legítimo)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 💰 SERVIÇOS DE PROXY RESIDENCIAL (Recomendados)

### 🥇 1. **Bright Data** (ex-Luminati) - MELHOR
```
💰 Custo: ~$500/mês (40GB) ou pay-as-you-go
🌍 IPs: Brasil (Vivo, Claro, NET, Oi)
⚡ Velocidade: Excelente
🎯 Confiabilidade: 99.9%
📊 Dashboard: Completo

🔗 https://brightdata.com/

✅ Mais usado por empresas
✅ Suporte 24/7
✅ Trial disponível
✅ API para rotação automática
```

### 🥈 2. **Smartproxy**
```
💰 Custo: ~$75/mês (8GB)
🌍 IPs: Brasil disponível
⚡ Velocidade: Boa
🎯 Confiabilidade: 99.5%

🔗 https://smartproxy.com/

✅ Mais barato
✅ Setup simples
✅ Trial de 3 dias
```

### 🥉 3. **Oxylabs**
```
💰 Custo: ~$600/mês (custom)
🌍 IPs: Brasil + LATAM
⚡ Velocidade: Excelente
🎯 Confiabilidade: 99.9%

🔗 https://oxylabs.io/

✅ Enterprise grade
✅ Suporte técnico dedicado
✅ Compliance GDPR/LGPD
```

### 💡 4. **IPRoyal** (Econômico)
```
💰 Custo: ~$7/GB (pay-as-you-go)
🌍 IPs: Brasil disponível
⚡ Velocidade: Razoável
🎯 Confiabilidade: 95%

🔗 https://iproyal.com/

✅ Mais acessível
✅ Sem mensalidade mínima
✅ Bom para testar
```

---

## 🔧 CONFIGURAÇÃO (Já Implementado!)

### 1️⃣ **No Código (✅ Já está pronto!)**

O código já suporta proxy via variável de ambiente `PROXY_URL`:

```typescript
// packages/api/src/routes/ml.ts
if (process.env.PROXY_URL) {
  const proxyUrl = new URL(process.env.PROXY_URL);
  axiosConfig.proxy = {
    host: proxyUrl.hostname,
    port: parseInt(proxyUrl.port || '80'),
    auth: proxyUrl.username && proxyUrl.password ? {
      username: proxyUrl.username,
      password: proxyUrl.password,
    } : undefined,
  };
}
```

### 2️⃣ **No Render (Configurar variável)**

#### Opção A: Via Dashboard
1. Acesse: https://dashboard.render.com/web/srv-d5nrh45actks73cmr8b0
2. Vá em **Environment**
3. Adicione variável:
   ```
   PROXY_URL = http://username:password@proxy-br.provider.com:12345
   ```
4. Clique **Save Changes**
5. Deploy automático

#### Opção B: Via API (Automático)
```powershell
$renderKey = "sua-api-key"
$serviceId = "srv-d5nrh45actks73cmr8b0"

$headers = @{
    "Authorization" = "Bearer $renderKey"
    "Content-Type" = "application/json"
}

$body = @(
    @{
        key = "PROXY_URL"
        value = "http://user:pass@proxy-br.brightdata.com:12345"
    }
) | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars" `
    -Headers $headers -Method Put -Body $body
```

---

## 🧪 TESTANDO O PROXY

### Teste 1: **Sem Proxy (Estado atual)**
```bash
GET https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone
```
**Resultado esperado:** ❌ 403 Forbidden

### Teste 2: **Com Proxy (Após configurar)**
```bash
GET https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone
```
**Resultado esperado:** ✅ 200 OK + lista de produtos

---

## 📊 CUSTOS ESTIMADOS

### Para o SEU volume (estimativa):

**Cenário: 1.000 buscas/dia**
- Cada busca: ~1-5 KB
- Total/mês: ~30-150 MB

**Custo mensal:**
- 🥇 Bright Data: ~$15-30/mês (pay-as-you-go)
- 🥈 Smartproxy: ~$10-20/mês (no plano de 8GB)
- 🥉 IPRoyal: ~$1-5/mês (paga só o que usar)

**Recomendação:** Começar com **IPRoyal** (mais barato) e escalar para **Bright Data** se precisar.

---

## 🎯 PASSO A PASSO (IMPLEMENTAÇÃO COMPLETA)

### Fase 1: **Contratar Proxy** (15 min)

1. **Acessar:** https://iproyal.com/ (ou Bright Data)
2. **Criar conta**
3. **Escolher:** Residential Proxies → Brasil
4. **Copiar credenciais:**
   ```
   Host: proxy-br.iproyal.com
   Port: 12323
   Username: seu-usuario
   Password: sua-senha
   ```

### Fase 2: **Configurar no Render** (5 min)

1. Dashboard Render → Environment Variables
2. Adicionar:
   ```
   PROXY_URL = http://seu-usuario:sua-senha@proxy-br.iproyal.com:12323
   ```
3. Save → Deploy automático

### Fase 3: **Testar** (2 min)

```bash
# Aguardar deploy (~2 min)
# Depois testar:
GET https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone
```

**Resultado esperado:**
```json
{
  "success": true,
  "total": 15834,
  "items": [
    {
      "id": "MLB123...",
      "title": "iPhone 15 Pro Max...",
      "price": 7899.90,
      ...
    }
  ]
}
```

---

## 🔒 SEGURANÇA

### ✅ Boas práticas:

1. **Nunca commitar proxy URL**
   - ✅ Usar apenas variáveis de ambiente
   - ✅ Adicionar ao `.gitignore`

2. **Rotacionar senhas regularmente**
   - Trocar senha do proxy mensalmente

3. **Monitorar uso**
   - Dashboards dos providers mostram consumo
   - Alertas de uso excessivo

4. **Limitar rate**
   - Não fazer mais de 10 req/s
   - ML pode bloquear mesmo com proxy

---

## 🚨 TROUBLESHOOTING

### Problema: Proxy não conecta
```
Erro: ECONNREFUSED ou ETIMEDOUT
```
**Solução:**
- Verificar credenciais
- Verificar se proxy está ativo no dashboard do provider
- Testar proxy em https://www.whatismyip.com/proxy-check/

### Problema: 403 mesmo com proxy
```
ML retorna 403 Forbidden
```
**Solução:**
- Trocar IP do proxy (rotação)
- Verificar se está usando IP brasileiro
- Adicionar delay entre requests (0.5-1s)

### Problema: Timeout
```
Erro: ETIMEDOUT após 15s
```
**Solução:**
- Aumentar timeout para 30s
- Trocar proxy (pode estar lento)
- Verificar saúde do proxy no dashboard

---

## 📈 ESCALANDO

### Quando você crescer:

**10K+ buscas/dia:**
- Usar **Bright Data** com rotação automática
- Implementar cache (Redis) para resultados recentes
- Pool de proxies (múltiplos IPs)

**100K+ buscas/dia:**
- Bright Data Enterprise
- Cache agressivo (1 hora)
- CDN para respostas

---

## 💡 ALTERNATIVAS AO PROXY

Se não quiser pagar proxy:

### 1. **Scraping (Puppeteer)**
- Usar navegador headless
- Mais lento, mas gratuito
- ~3-5 dias de dev

### 2. **Lomadee API**
- API oficial de afiliados
- Busca + links prontos
- Grátis (comissão sobre vendas)

### 3. **Cadastro Manual**
- Funciona hoje
- Curadoria humana
- Qualidade > Quantidade

---

## ✅ RECOMENDAÇÃO FINAL

### Para começar **HOJE:**

1. 🥇 **Contratar IPRoyal** (~$20 crédito inicial)
2. ⏱️ Configurar (20 min)
3. 🧪 Testar busca ML
4. 🚀 Começar a coletar ofertas!

### Custo total:
- **$20-50/mês** (pay-as-you-go)
- Sem mensalidades fixas
- Escala conforme necessidade

---

## 📞 PRÓXIMO PASSO

**Qual serviço de proxy você quer usar?**

1. 🥇 **IPRoyal** (econômico, $7/GB)
2. 🥈 **Smartproxy** (plano fixo, $75/mês)
3. 🥉 **Bright Data** (enterprise, $500/mês)

**Eu posso ajudar a:**
- Gerar script de configuração automática
- Testar conexão
- Monitorar logs

---

## 📚 REFERÊNCIAS

- IPRoyal: https://iproyal.com/residential-proxies
- Smartproxy: https://smartproxy.com/proxies/residential-proxies
- Bright Data: https://brightdata.com/proxy-types/residential-proxies
- Oxylabs: https://oxylabs.io/products/residential-proxy-pool

---

**Status:** ✅ Código pronto para proxy
**Falta:** Contratar serviço e configurar PROXY_URL
**Tempo:** 20-30 minutos
**Custo:** A partir de $20/mês

---

**Data:** 20/01/2026
**Versão:** 1.0
**Commit:** Próximo (após testes)
