# 🏗️ Arquitetura: OpenClaw + Promo Platform

> Como o OpenClaw e a Promo Platform trabalham juntos para automatizar
> a operação do canal "Manu das Promoções" com inteligência e custo controlado.

---

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        OPENCLAW (VPS)                           │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │ Manu             │    │ [Futuros Agentes] │                  │
│  │ Orquestradora    │    │ Manu Instagram    │                  │
│  │ (agente:main)    │    │ Manu WhatsApp     │                  │
│  │                  │    │ Manu X/Twitter    │                  │
│  │ • Cron 30min     │    └──────────────────┘                  │
│  │ • Cron semanal   │                                           │
│  │ • Heartbeat      │                                           │
│  │ • LEARNINGS.md   │                                           │
│  └────────┬─────────┘                                           │
│           │ HTTP requests                                        │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RENDER API (Promo Platform)                   │
│                                                                 │
│  /api/auto-promoter/search   → Busca produtos ML com desconto   │
│  /api/amazon/search          → Busca produtos Amazon            │
│  /api/affiliates/generate    → Gera link de afiliado ML         │
│  /api/images/search          → Busca imagem do produto          │
│  /api/telegram/message       → Posta no canal do Telegram       │
│  /api/auto-publish/publish   → Fluxo completo site + redes      │
│  /api/instagram/publish-now  → Publica no Instagram             │
│  /api/twitter/post-offer     → Publica no X/Twitter             │
│                                                                 │
│  IA: google/gemini-2.5-flash via OpenRouter                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CANAIS DE SAÍDA                         │
│                                                                 │
│  📱 Telegram @manupromocao  (-1003676225777)    ← ATIVO ✅      │
│  📸 Instagram @manudaspromocoes                 ← ATIVO ✅      │
│  🐦 X/Twitter @manupromocao                    ← ATIVO ✅      │
│  🌐 Site manu-promocoes.com.br                 ← ATIVO ✅      │
│  💬 WhatsApp                                   ← FUTURO 🔜     │
│  🎮 Discord                                    ← FUTURO 🔜     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agentes Propostos

### Agente 1: Manu Orquestradora (EXISTENTE ✅)
**Função:** Cérebro central da operação  
**Responsabilidades:**
- Executar cron de publicação a cada 30 minutos
- Buscar produtos via APIs da Promo Platform
- Gerar links de afiliado
- Publicar no Telegram com copy criativa
- Gerar relatório semanal de métricas
- Manter LEARNINGS.md atualizado
- Monitorar erros e reportar via heartbeat

---

### Agente 2: Manu Instagram (CRIAR)
**Função:** Especialista em conteúdo visual para Instagram  
**Responsabilidades:**
- Receber produto aprovado da Orquestradora
- Decidir formato: carrossel ou story
- Chamar `/api/instagram/publish-now` com tema escolhido
- Registrar resultado no LEARNINGS.md

**Como criar:**
```bash
openclaw agents add manu-instagram \
  --workspace /data/.openclaw/workspace-instagram
openclaw agents bind --agent manu-instagram --bind telegram:instagram
```

---

### Agente 3: Manu Relatório (CRIAR)
**Função:** Analista de métricas e performance  
**Responsabilidades:**
- Consolidar dados semanais de todos os canais
- Identificar produtos que mais converteram
- Sugerir horários de melhor engajamento
- Enviar relatório formatado para o Hudson via Telegram pessoal
- Atualizar `data/kpi-dashboard.md`

**Schedule sugerido:** Toda sexta às 18h (já existe o cron, só criar o agente dedicado)

---

### Agente 4: Manu Curadoria (FUTURO)
**Função:** Encontrar e validar as melhores ofertas  
**Responsabilidades:**
- Monitorar preços continuamente via web_search
- Comparar preço atual vs histórico
- Filtrar produtos com desconto real (não inflacionado)
- Criar fila de produtos aprovados para a Orquestradora publicar

---

## Fluxo Completo de Publicação (30 em 30 minutos)

```
[Cron dispara]
      │
      ▼
Manu verifica LEARNINGS.md
→ Quais produtos foram postados hoje?
→ Qual nicho foi postado por último?
      │
      ▼
Busca produto NOVO
→ GET /api/auto-promoter/search?q=NICHO&minDiscount=20
→ Se falhar: POST /api/amazon/search { keywords: NICHO }
→ Se ambos falharem: skipa esse ciclo, loga o erro
      │
      ▼
Valida produto
→ Tem imagem? Se não: GET /api/images/search
→ Tem preço claro? Se não: descarta
→ Já foi postado hoje? Se sim: busca outro
      │
      ▼
Gera link de afiliado
→ POST /api/affiliates/generate { url: URL_PRODUTO }
      │
      ▼
Escreve copy criativa
→ Headline agressiva (ex: "ESSA TV DESPENCOU DE PREÇO 😳🔥")
→ Preço: "DE R$ 3.089 → R$ 1.989 (-36%)"
→ CTA: "CORRE NA BIO ANTES QUE ACABE ⚠️"
→ Link de afiliado rastreável
      │
      ▼
Publica no Telegram
→ POST /api/telegram/message
  { chatId: "-1003676225777", text: copy, imageUrl: URL }
      │
      ▼
Registra no LEARNINGS.md
→ Produto, nicho, preço, canal, horário, resultado
      │
      ▼
[Aguarda próximo ciclo em 30min]
```

---

## Divisão de Responsabilidades

| O que precisa ser feito | Quem faz | Como |
|------------------------|----------|------|
| Buscar produtos ML | Render API | `/api/auto-promoter/search` |
| Buscar produtos Amazon | Render API | `/api/amazon/search` |
| Gerar link afiliado | Render API | `/api/affiliates/generate` |
| Buscar imagem | Render API | `/api/images/search` |
| Decidir qual produto postar | OpenClaw (Manu) | IA analisa e escolhe |
| Escrever copy criativa | OpenClaw (Manu) | IA gera texto no estilo Manu |
| Publicar no Telegram | Render API | `/api/telegram/message` |
| Publicar no Instagram | Render API | `/api/instagram/publish-now` |
| Publicar no X/Twitter | Render API | `/api/twitter/post-offer` |
| Publicar no site | Render API | `/api/auto-publish/publish` |
| Aprender e memorizar | OpenClaw (Manu) | LEARNINGS.md |
| Relatórios de performance | OpenClaw (Manu) | Cron semanal |
| Monitorar saúde do sistema | OpenClaw (Manu) | Heartbeat |

---

## Configuração de Custo Controlado

| Componente | Custo estimado |
|-----------|---------------|
| OpenClaw (VPS Hostinger) | ~$5-10/mês fixo |
| Gemini 2.5 Flash (OpenRouter) | ~$0,0001 por post |
| 48 posts/dia × 30 dias | ~$0,15/mês |
| Render API (backend) | $7/mês (plano atual) |
| **TOTAL ESTIMADO** | **~$12-17/mês** |

**Comparação:** Com GPT-4 a cada 5 minutos = **$140/dia** 💀  
**Com Gemini Flash a cada 30 minutos = ~$0,005/dia** ✅

---

## Próximos Passos Recomendados

### Imediato (hoje)
1. ✅ Corrigir modelo no cron para `google/gemini-2.5-flash`
2. ✅ Atualizar channel ID do Telegram para `-1003676225777`
3. ✅ Atualizar variáveis `OPENAI_MODEL_*` no Render para `google/gemini-2.5-flash`
4. 🔲 Atualizar SOUL da Manu com o fluxo correto de uso das APIs

### Curto prazo (esta semana)
5. 🔲 Criar agente Manu Instagram no OpenClaw
6. 🔲 Testar 3 ciclos completos de publicação automática
7. 🔲 Validar que posts chegam no Telegram com imagem e link afiliado

### Médio prazo (este mês)
8. 🔲 Criar agente Manu Relatório dedicado
9. 🔲 Adicionar WhatsApp como canal no OpenClaw
10. 🔲 Implementar fila de curadoria de produtos
