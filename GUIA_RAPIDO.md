# 🚀 GUIA RÁPIDO: 3 PASSOS PARA CADASTRAR SUA PRIMEIRA OFERTA

## 🎯 O MAIS FÁCIL: INTERFACE WEB

### 1️⃣ BUSCAR PRODUTO NO MERCADO LIVRE

Acesse: https://www.mercadolivre.com.br

**Exemplo de produto bom:**
- 🖱️ Mouse Gamer Logitech G203
- 💰 **De:** R$ 199,90
- 💵 **Por:** R$ 109,90
- 📊 **Desconto:** 45% OFF
- 🔗 **Link:** https://www.mercadolivre.com.br/mouse-gamer...

**Copie:**
- ✏️ Título completo
- 💰 Preço original
- 💵 Preço com desconto
- 🔗 Link do produto
- 🖼️ URL da imagem (botão direito na imagem → Copiar endereço)

---

### 2️⃣ ACESSAR PLATAFORMA E FAZER LOGIN

**Local (desenvolvimento):**
```
URL: http://localhost:3000
Email: admin@local.dev
Senha: admin123
```

**Produção:**
```
URL: https://promo-platform-admin.vercel.app
Email: admin@local.dev
Senha: admin123
```

---

### 3️⃣ CADASTRAR A OFERTA

#### No Menu Lateral:
1. Clicar em **"Ofertas"**
2. Clicar em **"+ Nova Oferta"** (botão superior direito)

#### Preencher Formulário:

**📝 Informações Básicas:**
```
Título: Mouse Gamer Logitech G203 RGB 8000 DPI
Descrição: Mouse gamer com RGB personalizável (opcional)
Link: https://www.mercadolivre.com.br/mouse-gamer...
```

**💰 Preços:**
```
Preço Original: 199.90
Preço Final: 109.90
(Desconto será calculado automaticamente: 45%)
```

**🏷️ Categorização:**
```
Nicho: Eletrônicos
Loja: Mercado Livre (ou escolher outra)
```

**🖼️ Imagem:**
```
URL da Imagem: https://http2.mlstatic.com/D_NQ_NP_...
```

**⚡ Configurações:**
```
Urgência: Normal / Hoje / Stock Low
Prioridade: Normal / Alta / Baixa
Status: Ativo
```

#### Salvar:
3. Clicar em **"Salvar Oferta"**
4. ✅ **Pronto!** Oferta cadastrada

---

## 📋 CRIAR POST (DRAFT)

### Opção A: Automático
- Sistema cria draft automaticamente quando você salva a oferta
- Copy é gerado pelo Copy Engine

### Opção B: Manual

1. **Menu:** "Drafts" → "+ Novo Draft"
2. **Selecionar:** A oferta que você acabou de criar
3. **Canais:** Marcar onde quer publicar
   - ☑️ Site Público (sempre marcar)
   - ☑️ Telegram (se configurado)
   - ☑️ X/Twitter (se configurado)
4. **Copy:** Será gerado automaticamente:

**Exemplo:**
```
Achei esse mouse gamer agora.
Caiu de R$ 199,90 pra R$ 109,90 👀

Não sei até quando fica assim.
```

5. **Salvar Draft**

---

## ✅ APROVAR E PUBLICAR

### No Painel:

1. **Menu:** "Drafts" ou "Cargas"
2. **Encontrar** seu draft
3. **Revisar** o texto e informações
4. **Clicar:** "✅ Aprovar"
5. **Sistema publica** automaticamente:
   - ✅ Cria PublishedPost
   - ✅ Aparece no site público
   - ✅ Registra no banco

---

## 🌐 VER NO SITE PÚBLICO

### Acessar:
```
Local: http://localhost:3003
Produção: https://manu-promocoes.vercel.app
```

### Você verá:
- 🏠 **Home/Feed:** Seu post no topo
- 🖼️ **Card bonito** com:
  - Imagem do produto
  - Título
  - Preços (antes/depois)
  - % de desconto
  - Badge do nicho
  - Nome da loja

### Testar Click:
- Clicar em **"VER OFERTA"**
- Sistema registra o click
- Redireciona para o Mercado Livre

---

## 🎯 RESUMO VISUAL

```
┌─────────────────────────────────────────┐
│  1. BUSCAR NO MERCADO LIVRE             │
│     ↓                                   │
│  📱 Copiar: título, preços, link        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. ACESSAR PLATAFORMA                  │
│     ↓                                   │
│  🔑 Login: admin@local.dev/admin123     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. CADASTRAR OFERTA                    │
│     ↓                                   │
│  📝 Ofertas → + Nova → Preencher → Save │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. CRIAR DRAFT (automático ou manual)  │
│     ↓                                   │
│  ✏️ Copy gerado pelo Copy Engine        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  5. APROVAR                             │
│     ↓                                   │
│  ✅ Drafts → Revisar → Aprovar          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  6. PUBLICADO!                          │
│     ↓                                   │
│  🌐 Ver em: manu-promocoes.vercel.app   │
└─────────────────────────────────────────┘
```

---

## 📱 EXEMPLO REAL

### Produto Escolhido:
```
🖱️ Mouse Gamer Logitech G203 RGB
💰 De: R$ 199,90 → Por: R$ 109,90
📊 45% OFF
🔗 https://mercadolivre.com.br/...
```

### Após Cadastrar:
✅ Aparece em: https://manu-promocoes.vercel.app  
✅ Card com imagem, título, preços  
✅ Botão "VER OFERTA" funcionando  
✅ Click tracking ativo  

---

## 🆘 PROBLEMAS?

### API não responde:
```bash
cd C:\Users\Acer\promo-platform\packages\api
npm run dev
```

### Frontend não abre:
```bash
cd C:\Users\Acer\promo-platform\apps\platform
npm run dev
```

### Site público não abre:
```bash
cd C:\Users\Acer\promo-platform\apps\site
npm run dev
```

---

## 🎉 PRONTO!

**Você já sabe cadastrar ofertas manualmente!**

Agora é só:
1. Buscar produtos com bom desconto
2. Cadastrar na plataforma
3. Aprovar
4. Publicar
5. Lucrar! 💰

---

## 💡 DICAS

### Bons Descontos:
- ✅ Mínimo 20% OFF
- ✅ Preço final acima de R$ 50
- ✅ Vendedor confiável
- ✅ Frete grátis é um plus

### Melhores Horários:
- 🕐 **18:00** - Saída do trabalho (MELHOR)
- 🕐 **11:00** - Pausa no trabalho
- 🕐 **22:00** - Noite, pessoal relaxando

### Sites para Achar Ofertas:
- 🔍 Mercado Livre (filtrar por desconto)
- 🔍 Pelando.com.br
- 🔍 Promobit.com.br
- 🔍 Zoom.com.br (comparador)

---

**🚀 BOA SORTE COM SUA PLATAFORMA!**
