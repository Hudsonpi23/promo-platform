# 📚 OpenClaw — Referência Completa
> Documentação consolidada para uso junto à Promo Platform.
> Última atualização: Abril 2026

---

## 1. O que é o OpenClaw

Gateway autohospedado (VPS) que conecta apps de mensagens (WhatsApp, Telegram, Discord, iMessage) a agentes de IA. Um único processo Gateway serve todos os canais simultaneamente.

**URL da VPS:** `https://openclaw-bebw.srv1537266.hstgr.cloud`  
**Workspace:** `/data/.openclaw/workspace`  
**Config:** `~/.openclaw/openclaw.json`

---

## 2. Configuração atual

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "google/gemini-2.5-flash" },
      "workspace": "/data/.openclaw/workspace"
    }
  },
  "env": {
    "OPENROUTER_API_KEY": "sk-or-..."
  }
}
```

**Modelo ativo:** `google/gemini-2.5-flash` via OpenRouter  
**Canal ativo:** Telegram — Channel ID `-1003676225777` (@manupromocao)  
**Agente principal:** Manu Orquestradora

---

## 3. Comandos essenciais (VPS)

### Gateway
```bash
openclaw gateway status          # status do serviço
openclaw gateway restart         # reiniciar
openclaw gateway stop            # parar
openclaw logs --follow --local-time  # logs em tempo real
openclaw health                  # saúde do gateway
openclaw doctor --repair         # diagnóstico + auto-reparo
```

### Crons
```bash
openclaw cron list               # listar crons
openclaw cron status             # status dos crons
openclaw cron add --name "nome" --every "30m" --message "..."
openclaw cron edit <id>          # editar cron existente
openclaw cron enable <id>        # habilitar cron
openclaw cron disable <id>       # desabilitar cron
openclaw cron runs --id <id>     # histórico de execuções
openclaw cron run <id> --force   # forçar execução agora
```

### Modelos
```bash
openclaw models status           # modelo atual
openclaw models list             # modelos disponíveis
openclaw models set google/gemini-2.5-flash  # trocar modelo
openclaw models scan --no-probe  # varrer modelos gratuitos OpenRouter
```

### Agentes
```bash
openclaw agents list             # listar agentes
openclaw agents add <nome>       # criar novo agente
openclaw agents bind --agent <id> --bind telegram:<conta>
openclaw agents bindings         # ver vínculos de roteamento
```

### Backup e segurança
```bash
openclaw backup create --output ~/Backups   # backup completo
openclaw backup create --only-config        # só config
openclaw security audit                     # auditoria
openclaw secrets audit --check             # verificar chaves
openclaw secrets reload                    # recarregar chaves
```

---

## 4. Crons configurados

### Cron 1 — Publicação Automática
- **ID:** `79ca5440-b718-4c9a-be57-e55c0567f90b`
- **Nome:** `promo-platform:auto-publish:24h`
- **Schedule:** `*/30 * * * *` (a cada 30 minutos)
- **Horário:** 7h às 23h (America/Sao_Paulo)
- **Modelo:** `google/gemini-2.5-flash`
- **Destino:** Canal Telegram `-1003676225777`

### Cron 2 — Relatório Semanal
- **ID:** `90ab8a68-8fc4-409f-b10c-844afcffe88`
- **Nome:** `manu-relatorio-semanal`
- **Schedule:** Toda sexta-feira às 18h (America/Sao_Paulo)
- **Modelo:** `google/gemini-2.5-flash`

---

## 5. Canais

### Telegram
- **Status:** Conectado ✅
- **Channel ID:** `-1003676225777`
- **Username:** `@manupromocao`
- **Chat ID do Hudson (pessoal):** `7114228848`
- **groupPolicy:** allowlist
- **dmPolicy:** emparelhame

### WhatsApp / Discord / iMessage
- **Status:** Não configurados (disponíveis para adicionar)

---

## 6. Ferramentas disponíveis (23/23 ativas)

| Ferramenta | Função |
|-----------|--------|
| `cron` | Agendar tarefas automáticas |
| `message` | Enviar mensagens nos canais |
| `web_search` | Pesquisar na internet |
| `web_fetch` | Buscar conteúdo de páginas |
| `exec` / `process` | Executar comandos shell |
| `browser` | Controlar navegador Chromium |
| `memory_search` / `memory_get` | Memória persistente |
| `read` / `write` / `edit` | Manipular arquivos |
| `sessions_spawn` | Criar subagentes |
| `image` | Analisar imagens |
| `gateway` | Controlar o gateway |
| `nodes` | Gerenciar dispositivos |

---

## 7. APIs da Promo Platform que a Manu deve usar

**Base URL:** `https://promo-platform-api.onrender.com`

### Busca de produtos
```
GET  /api/auto-promoter/search?q=KEYWORD&minDiscount=20
POST /api/amazon/search          Body: { "keywords": "KEYWORD" }
POST /api/amazon/product-from-url Body: { "url": "URL_AMAZON" }
```

### Links de afiliado
```
POST /api/affiliates/generate    Body: { "url": "URL_PRODUTO" }
```

### Imagens
```
GET  /api/images/search?q=NOME_PRODUTO
```

### Publicação no Telegram
```
POST /api/telegram/message
Body: {
  "chatId": "-1003676225777",
  "text": "mensagem com copy",
  "imageUrl": "URL_IMAGEM"
}
POST /api/telegram/post-offer/:offerId
```

### Publicação completa (site + redes)
```
POST /api/auto-publish/publish
Body: { "url": "URL_PRODUTO", "channels": ["telegram"] }
```

### Status e diagnóstico
```
GET  /api/telegram/status
GET  /api/auto-promoter/status
```

---

## 8. Fluxo correto de publicação automática

```
1. GET /api/auto-promoter/search?q=KEYWORD&minDiscount=20
   → Escolhe produto com desconto real e verificável

2. POST /api/affiliates/generate { url: "URL_PRODUTO" }
   → Obtém link de afiliado rastreável

3. GET /api/images/search?q=NOME_PRODUTO
   → Garante imagem de qualidade

4. Escreve copy criativa no estilo Manu
   → Headline agressiva, preço em destaque, urgência, CTA forte

5. POST /api/telegram/message
   { chatId: "-1003676225777", text: "copy", imageUrl: "URL" }
   → Publica no canal com imagem

6. Registra no LEARNINGS.md
   → Produto, nicho, preço, canal, horário, resultado
```

**REGRAS INVIOLÁVEIS:**
- NUNCA postar sem imagem
- NUNCA postar sem link de afiliado gerado pela API
- NUNCA repetir produto já postado no mesmo dia
- SEMPRE verificar LEARNINGS.md antes de cada post

---

## 9. Habilidades elegíveis (prontas para uso)

| Habilidade | Função |
|-----------|--------|
| `health-check` | Auditoria de segurança do host |
| `himalaya` | Gerenciar emails via IMAP/SMTP |
| `weather` | Previsão do tempo |
| `skill-creator` | Criar novas habilidades |
| `clawhub` | Instalar habilidades do marketplace |
| `openai-whisper-api` | Transcrição de áudio |

---

## 10. Solução de problemas comuns

| Sintoma | Causa | Solução |
|---------|-------|---------|
| `404 No endpoints found for model` | Modelo não existe no OpenRouter | Trocar para `google/gemini-2.5-flash` |
| `unauthorized` na conexão | Token do gateway errado | Verificar `OPENCLAW_GATEWAY_TOKEN` |
| Cron não executa | Schedule incorreto ou modelo inválido | `openclaw cron edit <id>` |
| Canal Telegram não recebe | Channel ID errado | Usar `-1003676225777` |
| Post sem imagem | Manu não chamou `/api/images/search` | Reforçar instrução no SOUL |
| Gateway não inicia | Config inválida | `openclaw doctor --repair` |
| Custo alto inesperado | Modelo caro (ex: GPT-4) | Verificar variáveis `OPENAI_MODEL_*` no Render |

---

## 11. Arquitetura de referência

```
OpenClaw (VPS)
├── Manu Orquestradora (agente principal)
│   ├── Cron: publicação a cada 30min
│   ├── Cron: relatório semanal (sexta 18h)
│   ├── Heartbeat: monitoramento contínuo
│   └── Memória: LEARNINGS.md, MEMORY.md
│
├── Canal: Telegram (@manupromocao)
│
└── Chama APIs:
    └── Render API (Promo Platform)
        ├── /api/auto-promoter/search
        ├── /api/affiliates/generate
        ├── /api/amazon/search
        ├── /api/images/search
        └── /api/telegram/message
```

---

## 12. Referências rápidas

- **Dashboard OpenClaw:** `https://openclaw-bebw.srv1537266.hstgr.cloud`
- **OpenRouter (modelos):** `https://openrouter.ai/keys`
- **Render API (BASE_URL):** `https://promo-platform-api.onrender.com`
- **Render Dashboard:** `https://dashboard.render.com`
- **Canal Telegram:** `https://t.me/manupromocao`
- **Documentação oficial OpenClaw:** `https://docs.openclaw.ai`
