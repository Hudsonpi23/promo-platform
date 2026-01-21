# 📝 GUIA: Cadastrar Ofertas Manualmente

## 🎯 FLUXO COMPLETO

```
1. Buscar produto no Mercado Livre
   ↓
2. Cadastrar Oferta na Plataforma
   ↓
3. Criar Draft (post)
   ↓
4. Revisar e Aprovar
   ↓
5. Publicar
   ↓
6. Ver no Site Público
```

---

## 📋 PASSO 1: BUSCAR PRODUTO NO MERCADO LIVRE

### No navegador:
1. Acesse: https://www.mercadolivre.com.br
2. Busque por categoria (ex: "notebook gamer", "iphone 15", "air fryer")
3. Filtrar por:
   - ✅ Frete grátis
   - ✅ Desconto
   - ✅ Mais vendidos

### Escolher um bom produto:
- ✅ Desconto de **pelo menos 20%**
- ✅ Preço final acima de **R$ 50**
- ✅ Boa reputação do vendedor
- ✅ Estoque disponível
- ✅ Boas avaliações

### Copiar informações:
- 📋 **Título** do produto
- 💰 **Preço original** (antes do desconto)
- 💵 **Preço atual** (com desconto)
- 🔗 **Link** do produto
- 🖼️ **URL da imagem** (clique com botão direito na imagem → Copiar endereço da imagem)
- 🏪 **Nome da loja/vendedor**

**Exemplo:**
```
Título: Notebook Gamer Lenovo IdeaPad Gaming 3i Intel Core i5 16GB 512GB SSD RTX 3050
Preço Original: R$ 4.999,00
Preço Atual: R$ 3.499,00
Desconto: 30%
Link: https://produto.mercadolivre.com.br/MLB-XXXXXXXX
Imagem: https://http2.mlstatic.com/D_NQ_NP_XXXXXXXX.webp
Loja: Mercado Livre
```

---

## 📋 PASSO 2: FAZER LOGIN NA PLATAFORMA

### API Local (desenvolvimento):
```
URL: http://localhost:3000
ou
URL: https://promo-platform-admin.vercel.app
```

### Credenciais:
```
Email: admin@local.dev
Senha: admin123
```

---

## 📋 PASSO 3: CADASTRAR OFERTA

### Via Interface (Recomendado):

1. **Acessar "Ofertas"** no menu lateral
2. **Clicar em "+ Nova Oferta"**
3. **Preencher formulário:**

   **Informações Básicas:**
   - ✏️ **Título**: Cole o título do produto
   - 📝 **Descrição**: Escreva uma descrição curta (opcional)
   - 🔗 **Link Afiliado**: Cole o link do ML
   
   **Preços:**
   - 💰 **Preço Original**: Ex: 4999.00
   - 💵 **Preço Final**: Ex: 3499.00
   - 📊 **Desconto (%)**: Será calculado automaticamente → 30%
   
   **Categorização:**
   - 🏷️ **Nicho**: Escolher (Eletrônicos, Moda, Casa, etc)
   - 🏪 **Loja**: Escolher ou criar nova
   
   **Extras:**
   - 🖼️ **URL da Imagem**: Cole o link da imagem
   - ⚡ **Urgência**: Escolher (HOJE, STOCK_LOW, NORMAL)
   - ⭐ **Prioridade**: ALTA / NORMAL / BAIXA

4. **Clicar em "Salvar Oferta"**

---

### Via API (Alternativa):

Se preferir usar API diretamente:

```bash
POST http://localhost:3001/api/offers
Content-Type: application/json
Authorization: Bearer SEU_TOKEN

{
  "title": "Notebook Gamer Lenovo IdeaPad Gaming 3i",
  "affiliateUrl": "https://produto.mercadolivre.com.br/MLB-XXXXXXXX",
  "originalPrice": 4999.00,
  "finalPrice": 3499.00,
  "imageUrl": "https://http2.mlstatic.com/D_NQ_NP_XXXXXXXX.webp",
  "nicheId": "ID_DO_NICHO_ELETRONICOS",
  "storeId": "ID_DA_LOJA_MERCADO_LIVRE",
  "urgency": "NORMAL",
  "priority": "NORMAL",
  "status": "ACTIVE"
}
```

---

## 📋 PASSO 4: CRIAR DRAFT (POST)

### Automático:
- Quando você salva uma oferta, o sistema pode criar um draft automaticamente
- O **Copy Engine** gera o texto do post

### Manual:

1. **Acessar "Drafts"** no menu
2. **Clicar em "+ Novo Draft"**
3. **Selecionar a Oferta** que acabou de cadastrar
4. **Escolher Canais:**
   - ☑️ Telegram
   - ☑️ WhatsApp
   - ☑️ Facebook
   - ☑️ X (Twitter)
   - ☑️ Site Público

5. **Atribuir a uma Carga:**
   - 🕐 08:00
   - 🕐 11:00
   - 🕐 14:00
   - 🕐 18:00
   - 🕐 22:00

6. **Copy do Post:**
   - Será gerado automaticamente pelo Copy Engine
   - Você pode editar se quiser

**Exemplo de Copy (gerado automaticamente):**
```
Telegram:
"Achei isso agora.
Caiu de R$ 4.999 pra R$ 3.499.

Não sei até quando fica assim.

https://seu-link"

Site:
"Achei isso agora.
Caiu de R$ 4.999 pra R$ 3.499."

X (Twitter):
"Achei isso agora.
De R$ 4.999 por R$ 3.499

https://seu-link"
```

7. **Salvar Draft**

---

## 📋 PASSO 5: REVISAR E APROVAR

### No Painel de Cargas:

1. **Acessar "Cargas"** no menu
2. **Selecionar a carga** (ex: Carga 14:00)
3. **Ver todos os drafts** daquela carga
4. **Para cada draft:**
   - 👁️ **Visualizar** o preview do post
   - ✏️ **Editar** se necessário (corrigir texto, trocar imagem)
   - ✅ **Aprovar** (botão verde "OK")
   - ❌ **Reprovar** (se não gostar)

5. **Quando terminar a revisão:**
   - **Modo Rápido**: Cada "OK" dispara imediatamente
   - **Modo Carga**: Clicar em "Disparar Carga 14:00" para enviar todos

---

## 📋 PASSO 6: PUBLICAR

### Aprovação Individual:

1. **Clicar em "✅ Aprovar"** no draft
2. Sistema cria **PostDelivery** para cada canal
3. **Workers** processam os envios:
   - 📱 Telegram → Bot envia mensagem
   - 📱 WhatsApp → API envia mensagem
   - 📘 Facebook → Graph API posta
   - 🐦 X (Twitter) → API v2 tweeta
   - 🌐 Site → Cria **PublishedPost**

### Verificar Status:

1. **Acessar "Publicações"** no menu
2. **Ver lista** de posts publicados
3. **Status por canal:**
   - ✅ SENT (enviado)
   - ⏳ PENDING (aguardando)
   - ❌ ERROR (falhou)
   - 🔄 RETRY (tentando novamente)

---

## 📋 PASSO 7: VER NO SITE PÚBLICO

### Acessar o Site:
```
Local: http://localhost:3003
Produção: https://manu-promocoes.vercel.app
```

### O que você verá:

1. **Home / Feed:**
   - Seu post aparece no topo (mais recente)
   - Card com:
     - 🖼️ Imagem do produto
     - 📝 Título
     - 💰 Preços (antes/depois)
     - 📊 % de desconto
     - 🏷️ Badge do nicho
     - 🏪 Nome da loja
     - ⚡ Selo de urgência (se tiver)

2. **Filtrar por Nicho:**
   - Clicar no badge do nicho
   - Ver todos os posts daquele nicho

3. **Clicar em "VER OFERTA":**
   - Sistema registra o click
   - Redireciona para `/go/:code`
   - Depois redireciona para o Mercado Livre

---

## 📊 PASSO 8: ACOMPANHAR MÉTRICAS (OPCIONAL)

### Ver Estatísticas:

1. **Acessar "Estatísticas"** no menu
2. **Ver:**
   - 📈 Total de clicks
   - 📊 Clicks por canal
   - 🏷️ Clicks por nicho
   - 🏪 Clicks por loja
   - 📅 Clicks por dia

---

## 🎯 EXEMPLO PRÁTICO COMPLETO

### 1. Produto escolhido no ML:
```
Air Fryer Philips Walita Airfryer XXL Digital 6.2L
De: R$ 899,00
Por: R$ 499,00
Desconto: 44%
Link: https://produto.mercadolivre.com.br/MLB-3456789012
```

### 2. Cadastrar Oferta:
- Título: "Air Fryer Philips Walita XXL 6.2L Digital"
- Preço Original: 899.00
- Preço Final: 499.00
- Nicho: Casa
- Loja: Mercado Livre
- Urgência: STOCK_LOW (poucas unidades)

### 3. Draft criado automaticamente:
```
Copy (Telegram):
"Tava olhando e vi isso.
Caiu de R$ 899 pra R$ 499 👀

Não sei até quando fica assim.

https://link-afiliado"
```

### 4. Aprovar:
- Revisar no painel
- Clicar "✅ OK"

### 5. Publicado:
- Aparece em: https://manu-promocoes.vercel.app
- Enviado no Telegram (se configurado)
- Postado no X/Twitter (se configurado)

---

## ✅ CHECKLIST RÁPIDO

- [ ] Buscar produto com bom desconto no ML
- [ ] Copiar: título, preços, link, imagem
- [ ] Fazer login na plataforma
- [ ] Cadastrar oferta (Ofertas → + Nova)
- [ ] Criar draft (ou automático)
- [ ] Escolher canais e carga
- [ ] Revisar no painel de cargas
- [ ] Aprovar (✅ OK)
- [ ] Verificar publicação
- [ ] Acessar site público
- [ ] Testar click no botão "Ver Oferta"

---

## 🚀 DICAS PRO

### Encontrar Boas Ofertas:
1. **Usar filtros do ML:**
   - Frete grátis
   - Desconto
   - Vendedores oficiais

2. **Sites agregadores:**
   - Pelando.com.br
   - Promobit.com.br
   - Zoom.com.br

3. **Extensões do navegador:**
   - Honey
   - Karma

### Otimizar Copy:
- ✅ Usar linguagem natural (evitar "robô vibes")
- ✅ Mencionar preços sempre
- ✅ Criar senso de urgência (mas de forma natural)
- ✅ Um emoji no máximo
- ✅ Frases curtas

### Timing:
- 🕐 **08:00** - Café da manhã (pessoal no trânsito)
- 🕐 **11:00** - Meio da manhã (pausa no trabalho)
- 🕐 **14:00** - Pós-almoço
- 🕐 **18:00** - Saída do trabalho ⭐ MELHOR
- 🕐 **22:00** - Noite (pessoal relaxando)

---

## 🆘 PROBLEMAS COMUNS

### Oferta não aparece no site:
- ✅ Verificar se está com status "PUBLISHED"
- ✅ Verificar se `isActive = true`
- ✅ Limpar cache do navegador

### Click não está redirecionando:
- ✅ Verificar se `goCode` foi gerado
- ✅ Testar rota `/go/:code` diretamente

### Copy não ficou boa:
- ✅ Editar manualmente no draft
- ✅ Ajustar templates do Copy Engine

---

## 📞 SUPORTE

Se tiver dúvidas, verifique:
- 📖 README.md
- 🐛 Logs do servidor
- 💬 Console do navegador (F12)

---

**🎉 PRONTO! Agora você sabe cadastrar ofertas manualmente!**
