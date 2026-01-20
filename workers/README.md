# Workers Python - Promo Platform

Workers de automação para coleta, validação, publicação e divulgação de ofertas.

## Estrutura

```
workers/
├── collector/       # IA Coletora - busca ofertas
│   └── main.py
├── validator/       # IA Validadora - verifica ofertas
│   └── main.py
├── publisher/       # IA Publicadora - gera posts
│   └── main.py
├── dispatcher/      # Dispatchers de canais sociais
│   ├── base.py      # Classe base
│   ├── twitter.py   # Twitter/X dispatcher
│   └── telegram.py  # Telegram dispatcher
├── config.py        # Configurações compartilhadas
├── main.py          # Orquestrador principal
└── requirements.txt
```

## Instalação

```bash
cd workers
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

## Configuração

Crie um arquivo `.env` na pasta `workers/`:

```env
# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/promo_platform

# API
API_URL=http://localhost:3001

# OpenAI (para geração de copy)
OPENAI_API_KEY=sk-...

# Lomadee (programa de afiliados)
LOMADEE_APP_TOKEN=seu_token
LOMADEE_SOURCE_ID=seu_source_id

# ================================
# SOCIAL MEDIA - Canais de Divulgação
# ================================

# Twitter/X API v2
TWITTER_BEARER_TOKEN=seu_bearer_token
TWITTER_API_KEY=sua_api_key
TWITTER_API_SECRET=sua_api_secret
TWITTER_ACCESS_TOKEN=seu_access_token
TWITTER_ACCESS_SECRET=seu_access_secret

# Telegram Bot API
TELEGRAM_BOT_TOKEN=seu_bot_token
TELEGRAM_CHAT_ID=@manupromocao

# WhatsApp (via Twilio - opcional)
# TWILIO_ACCOUNT_SID=seu_account_sid
# TWILIO_AUTH_TOKEN=seu_auth_token
# TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Configurações
MINIMUM_DISCOUNT=20
MAX_OFFERS_PER_RUN=50
```

## Uso

### Executar pipeline completo
```bash
python main.py pipeline
```

### Executar apenas coleta
```bash
python main.py collect
```

### Executar apenas validação
```bash
python main.py validate
```

### Executar apenas publicação
```bash
python main.py publish
```

### Executar com scheduler (produção)
```bash
python main.py scheduler
```

## Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Coletora   │ --> │ Validadora  │ --> │ Publicadora │ --> │ Dispatchers │
│             │     │             │     │             │     │             │
│ - Lomadee   │     │ - Desconto  │     │ - Copy IA   │     │ - Telegram  │
│ - APIs      │     │ - Duplicata │     │ - Canais    │     │ - Twitter   │
│ - Manual    │     │ - Nicho     │     │ - Batch     │     │ - WhatsApp  │
└─────────────┘     └─────────────┘     └─────────────┘     │ - Facebook  │
       │                   │                   │            │ - Site      │
       ▼                   ▼                   ▼            └─────────────┘
   [Offers]           [Validated]         [PostDrafts]           │
                                                                 ▼
                                                          [PostDelivery]
```

## Workers

### 1. IA Coletora (`collector/`)
- Integra com Lomadee API
- Busca ofertas com desconto >= 20%
- Salva ofertas no banco

### 2. IA Validadora (`validator/`)
- Verifica se desconto é real
- Detecta nicho automaticamente
- Remove duplicatas
- Define urgência

### 3. IA Publicadora (`publisher/`)
- Gera copy usando OpenAI (ou fallback)
- Recomenda canais por tipo de oferta
- Seleciona carga apropriada
- Cria PostDrafts

### 4. Dispatchers (`dispatcher/`)

Os dispatchers são responsáveis por enviar os posts aprovados para cada canal:

#### Twitter/X (`dispatcher/twitter.py`)
- Usa API oficial v2 via `tweepy`
- Formata posts para máx 280 caracteres
- Suporta emojis e links curtos
- Handle: @manupromocao

```python
from dispatcher import TwitterDispatcher, PostContent

dispatcher = TwitterDispatcher(config)
result = await dispatcher.send(post)
print(f"Tweet ID: {result.external_id}")
```

#### Telegram (`dispatcher/telegram.py`)
- Usa Bot API via `python-telegram-bot`
- Suporta HTML formatting
- Envia para canal @manupromocao
- Suporta imagens

```python
from dispatcher import TelegramDispatcher, PostContent

dispatcher = TelegramDispatcher(config)
result = await dispatcher.send(post)
print(f"Message ID: {result.external_id}")
```

## Canais Suportados

| Canal | Status | Biblioteca | Config Necessária |
|-------|--------|------------|-------------------|
| 📱 Telegram | ✅ Ativo | python-telegram-bot | BOT_TOKEN, CHAT_ID |
| 🐦 Twitter/X | ✅ Ativo | tweepy | API Keys + Tokens |
| 💬 WhatsApp | 🔜 Planejado | twilio | Account SID, Auth Token |
| 👤 Facebook | 🔜 Planejado | facebook-sdk | Page Token |
| 🌐 Site | ✅ Ativo | interno | - |

## Scheduler

O scheduler executa automaticamente:

| Horário | Ação |
|---------|------|
| 07:00 | Pipeline completo |
| 07:30 | Publicador + Dispatch |
| 10:00 | Pipeline completo |
| 10:30 | Publicador + Dispatch |
| 13:00 | Pipeline completo |
| 13:30 | Publicador + Dispatch |
| 17:00 | Pipeline completo |
| 17:30 | Publicador + Dispatch |
| 21:30 | Publicador + Dispatch |

Isso garante que sempre haja posts prontos antes de cada carga (08h, 11h, 14h, 18h, 22h).

## Configurando Twitter/X

1. Acesse [developer.twitter.com](https://developer.twitter.com)
2. Crie um projeto e app
3. Gere as credenciais:
   - API Key & Secret
   - Access Token & Secret
   - Bearer Token
4. Configure permissões de escrita (Write)
5. Adicione as variáveis no `.env`

## Logs

Os logs são salvos em arquivos diários:
- `collector.log`
- `validator.log`
- `publisher.log`
- `dispatcher.log`
- `workers.log` (geral)

Retenção: 7 dias.
