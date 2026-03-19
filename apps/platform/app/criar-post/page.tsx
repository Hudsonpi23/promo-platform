'use client';

import { useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// ─── Tipos de post ────────────────────────────────────────────────────────────
const POST_TYPES = [
  { id: 'aviso',         label: 'Aviso',         icon: '📣' },
  { id: 'sorteio',       label: 'Sorteio',       icon: '🏆' },
  { id: 'quiz',          label: 'Quiz',          icon: '🧠' },
  { id: 'agradecimento', label: 'Agradecimento', icon: '🙏' },
  { id: 'cupom',         label: 'Cupom',         icon: '🎟️' },
  { id: 'pergunta',      label: 'Pergunta',      icon: '💬' },
  { id: 'metricas',      label: 'Métricas',      icon: '📊' },
  { id: 'outro',         label: 'Outro',         icon: '✏️' },
] as const;

// ─── Templates por tipo ────────────────────────────────────────────────────────
const TEMPLATES: Record<string, string[]> = {
  sorteio: [
    `🏆 SORTEIO PIX — R$150 💸\n\nQuer ganhar? Então participa!\n\nPara participar:\n✅ Seguir a página\n✅ Curtir e repostar\n✅ Marcar 2 amigos\n✅ Comentar qual produto quer em promoção\n\n🥇 1º lugar — R$80\n🥈 2º lugar — R$50\n🥉 3º lugar — R$20\n\n📅 Sorteio: DD/MM às HH:00`,
    `🎁 SORTEIO ESPECIAL!\n\nSeguindo + repostando você concorre a R$XX no PIX!\n\n✅ Segue o canal\n✅ Curte e reposta\n✅ Marca 1 amigo nos comentários\n\n📅 Resultado: DD/MM`,
  ],
  quiz: [
    `🧠 QUIZ DO DIA!\n\nQual dessas marcas tem o melhor custo-benefício?\n\n1️⃣ Samsung\n2️⃣ Xiaomi\n3️⃣ Motorola\n4️⃣ Apple\n\n👇 Responde nos comentários!`,
    `🤔 VOCÊ SABIA?\n\nQual é o melhor horário para comprar online e pegar os maiores descontos?\n\n1️⃣ De manhã\n2️⃣ À tarde\n3️⃣ À noite\n4️⃣ Madrugada\n\n👇 Comenta sua resposta!`,
  ],
  agradecimento: [
    `🙏 MUITO OBRIGADO!\n\nChegamos em XXX seguidores! Isso é incrível!\n\nVocês são a razão de eu buscar os melhores descontos todos os dias 💪\n\nContinuem acompanhando — tem muita promoção boa vindo por aí! 🔥`,
    `❤️ OBRIGADO PELA CONFIANÇA!\n\nXXX seguidores e crescendo!\n\nEu me comprometo a sempre trazer o MENOR PREÇO que encontrar. Vocês merecem o melhor! 🛒`,
  ],
  pergunta: [
    `💬 PESQUISA RÁPIDA!\n\nQual nicho você quer VER MAIS aqui no canal?\n\n📱 Eletrônicos\n👟 Moda e Calçados\n💪 Suplementos\n🏠 Casa e Decoração\n\n👇 Comenta abaixo!`,
    `🤝 PRECISO DA SUA AJUDA!\n\nQue tipo de promoção você prefere?\n\n1️⃣ Desconto alto (50%+)\n2️⃣ Produto do dia a dia barato\n3️⃣ Eletrônicos e tech\n4️⃣ Moda e lifestyle\n\n👇 Me conta nos comentários!`,
  ],
  cupom: [
    `🎟️ CUPOM EXCLUSIVO!\n\nUse o cupom PROMO10 e ganhe 10% OFF em toda a loja!\n\n🛒 Válido até DD/MM\n⚡ Corre que é por tempo limitado!\n\n👉 Link na bio`,
    `💸 CUPOM DE DESCONTO!\n\nXX% OFF usando o código: XXXXXXX\n\n✅ Válido em toda a loja\n📅 Expira em: DD/MM/AAAA\n\n🛒 Aproveita agora!`,
  ],
  aviso: [
    `📣 AVISO IMPORTANTE!\n\nHoje tem sessão especial de promoções a partir das 20h! 🔥\n\nFique ligado que vem coisa boa por aí 👀`,
    `⚡ ATENÇÃO SEGUIDORES!\n\nNova categoria chegando no canal: [CATEGORIA]!\n\nSe prepara para os melhores descontos 🛒`,
  ],
  metricas: [
    `📊 RESULTADOS DA SEMANA!\n\n📤 Posts publicados: XX\n💰 Desconto médio: XX%\n💵 Economia total gerada: R$ XXXX\n\nObrigado por acompanhar! Juntos economizamos mais 🙏`,
  ],
  outro: [
    `✏️ Escreva seu post aqui...`,
  ],
};

// ─── Emojis por categoria ─────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    label: 'Hype 🔥',
    emojis: ['🔥','⚡','💥','🚀','🎯','👑','💎','⭐','🌟','✨','💫','🏆','🥇','🎉','🎊'],
  },
  {
    label: 'Dinheiro 💰',
    emojis: ['💰','💵','💸','💳','🏷️','🎟️','🤑','💹','📈','🛒','🛍️','🎁','🧾','💲','🏦'],
  },
  {
    label: 'Expressões 😀',
    emojis: ['😀','😂','😍','🥳','😎','🤩','🤑','😱','🥺','💪','👏','🙏','👍','❤️','🫶'],
  },
  {
    label: 'Avisos ✅',
    emojis: ['✅','☑️','✔️','❌','⚠️','📣','📢','🔔','🔕','📌','📍','👉','👈','👇','👆'],
  },
  {
    label: 'Tempo ⏰',
    emojis: ['⏰','⏳','🕐','📅','📆','🗓️','⌛','🔜','🆕','🆓','🔝','🔛','🔙','⏩','🏃'],
  },
  {
    label: 'Números 1️⃣',
    emojis: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🥇','🥈','🥉','#️⃣','*️⃣'],
  },
];

// ─── Componente de Preview X ──────────────────────────────────────────────────
function XPreview({ text, imageUrl }: { text: string; imageUrl: string | null }) {
  return (
    <div className="bg-black border border-gray-700 rounded-2xl p-4 max-w-sm font-sans">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          P
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-white font-bold text-sm">Seu Canal</span>
            <span className="text-gray-500 text-sm">@seucanal · agora</span>
          </div>
          <p className="text-white text-sm whitespace-pre-wrap break-words leading-relaxed">
            {text || <span className="text-gray-600 italic">Seu post vai aparecer aqui...</span>}
          </p>
          {imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-700">
              <img src={imageUrl} alt="Preview" className="w-full object-cover max-h-64" />
            </div>
          )}
          <div className="flex gap-5 mt-3 text-gray-500 text-xs">
            <span>💬 0</span>
            <span>🔁 0</span>
            <span>❤️ 0</span>
            <span>📊</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de Preview Telegram ──────────────────────────────────────────
function TelegramPreview({ text, imageUrl }: { text: string; imageUrl: string | null }) {
  return (
    <div className="bg-[#212d3b] rounded-2xl p-4 max-w-sm font-sans">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
          P
        </div>
        <span className="text-[#6ab3f3] font-semibold text-sm">Seu Canal</span>
      </div>
      {imageUrl && (
        <div className="rounded-xl overflow-hidden mb-2">
          <img src={imageUrl} alt="Preview" className="w-full object-cover max-h-64" />
        </div>
      )}
      <p className="text-[#e4e6ea] text-sm whitespace-pre-wrap break-words leading-relaxed">
        {text || <span className="text-gray-600 italic">Seu post vai aparecer aqui...</span>}
      </p>
      <div className="mt-2 text-right text-[#7d8e9e] text-xs">
        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CriarPostPage() {
  const [postType, setPostType]       = useState('aviso');
  const [text, setText]               = useState('');
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEmojis, setShowEmojis]   = useState(false);
  const [emojiCat, setEmojiCat]       = useState(0);
  const [sendingX, setSendingX]       = useState(false);
  const [sendingTg, setSendingTg]     = useState(false);
  const [feedback, setFeedback]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const X_LIMIT = 280;
  const charCount = text.length;
  const xOver = charCount > X_LIMIT;

  // ── Inserir emoji na posição do cursor ────────────────────────────────────
  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) { setText(p => p + emoji); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }, [text]);

  // ── Aplicar template ──────────────────────────────────────────────────────
  const applyTemplate = (tpl: string) => {
    setText(tpl);
    textareaRef.current?.focus();
  };

  // ── Upload de imagem ──────────────────────────────────────────────────────
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', msg: 'Apenas imagens são aceitas (JPG, PNG, WebP)' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'error', msg: 'Imagem muito grande. Máximo: 10MB' });
      return;
    }
    setUploadingImage(true);
    setFeedback(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res  = await fetchWithAuth('/api/upload/base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, folder: 'promo-platform/criar-post' }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setImageUrl(data.data.url);
        setFeedback({ type: 'success', msg: '✅ Imagem carregada!' });
      } else {
        setFeedback({ type: 'error', msg: data.message || 'Falha no upload da imagem' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  // ── Postar no X ───────────────────────────────────────────────────────────
  const handlePostX = async () => {
    if (!text.trim() || sendingX) return;
    setSendingX(true);
    setFeedback(null);
    try {
      const body: any = { text: text.trim() };
      if (imageUrl) body.imageUrl = imageUrl;
      const res  = await fetchWithAuth('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || data.tweetUrl) {
        setFeedback({ type: 'success', msg: `✅ Postado no X! ${data.tweetUrl || ''}` });
      } else {
        setFeedback({ type: 'error', msg: `❌ X: ${data.error || 'Erro desconhecido'}` });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: `❌ ${e.message}` });
    } finally {
      setSendingX(false);
    }
  };

  // ── Postar no Telegram ────────────────────────────────────────────────────
  const handlePostTelegram = async () => {
    if (!text.trim() || sendingTg) return;
    setSendingTg(true);
    setFeedback(null);
    try {
      const body: any = { text: text.trim() };
      if (imageUrl) body.imageUrl = imageUrl;
      const res  = await fetchWithAuth('/api/telegram/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', msg: `✅ Enviado no Telegram! ID: ${data.messageId}` });
      } else {
        setFeedback({ type: 'error', msg: `❌ Telegram: ${data.error || 'Erro desconhecido'}` });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: `❌ ${e.message}` });
    } finally {
      setSendingTg(false);
    }
  };

  const templates = TEMPLATES[postType] || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">✏️ Criar Post</h1>
        <p className="text-text-muted text-sm">Crie qualquer tipo de post com preview em tempo real</p>
      </div>

      {/* Tipo de post */}
      <div className="flex flex-wrap gap-2">
        {POST_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setPostType(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
              postType === t.id
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-muted hover:border-primary/50 hover:text-text-primary'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── EDITOR ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-text-primary text-sm">📝 Editor</h2>

            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                rows={10}
                placeholder="Escreva seu post aqui... Use os emojis abaixo e os templates como ponto de partida."
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className={cn('text-xs', xOver ? 'text-red-400 font-bold' : 'text-text-muted')}>
                  {charCount}/{X_LIMIT} X
                </span>
              </div>
            </div>

            {xOver && (
              <p className="text-xs text-red-400">
                ⚠️ {charCount - X_LIMIT} chars acima do limite do X. Você ainda pode postar no Telegram sem limite.
              </p>
            )}

            {/* Barra de ferramentas */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowEmojis(p => !p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  showEmojis
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'border-border text-text-muted hover:border-primary/50'
                )}
              >
                😀 Emojis
              </button>
              <button
                onClick={() => setText('')}
                disabled={!text}
                className="px-3 py-1.5 rounded-lg text-sm border border-border text-text-muted hover:border-red-400/50 hover:text-red-400 transition-all disabled:opacity-40"
              >
                🗑️ Limpar
              </button>
            </div>

            {/* Emoji picker */}
            {showEmojis && (
              <div className="border border-border rounded-xl bg-background overflow-hidden">
                {/* Categorias */}
                <div className="flex overflow-x-auto gap-1 p-2 border-b border-border">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                      key={i}
                      onClick={() => setEmojiCat(i)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-all shrink-0',
                        emojiCat === i
                          ? 'bg-primary/20 text-primary'
                          : 'text-text-muted hover:text-text-primary'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {/* Emojis */}
                <div className="flex flex-wrap gap-1 p-3">
                  {EMOJI_CATEGORIES[emojiCat].emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-9 h-9 text-xl rounded-lg hover:bg-primary/10 transition-all flex items-center justify-center"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload de imagem */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-text-primary text-sm">🖼️ Imagem (opcional)</h2>

            {imageUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imageUrl} alt="Imagem do post" className="w-full object-cover max-h-48" />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-xs hover:bg-red-500/80 transition-all flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-green-400">✅ Imagem carregada — será incluída no post</p>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-all"
              >
                {uploadingImage ? (
                  <p className="text-text-muted text-sm">⏳ Enviando imagem...</p>
                ) : (
                  <>
                    <p className="text-3xl mb-2">📁</p>
                    <p className="text-text-muted text-sm">Arraste uma imagem aqui ou <span className="text-primary">clique para escolher</span></p>
                    <p className="text-text-muted text-xs mt-1">JPG, PNG, WebP — máx 10MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-text-primary text-sm">📋 Templates — {POST_TYPES.find(t => t.id === postType)?.icon} {POST_TYPES.find(t => t.id === postType)?.label}</h2>
              <div className="space-y-2">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary hover:bg-primary/5 transition-all"
                  >
                    <span className="text-primary font-medium">Template {i + 1}</span>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap">{tpl.slice(0, 120)}...</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={cn(
              'px-4 py-3 rounded-xl text-sm font-medium',
              feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            )}>
              {feedback.msg}
            </div>
          )}

          {/* Botões de publicação */}
          <div className="flex gap-3">
            <button
              onClick={handlePostTelegram}
              disabled={!text.trim() || sendingTg}
              className="flex-1 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendingTg ? '⏳ Enviando...' : '📱 Postar no Telegram'}
            </button>
            <button
              onClick={handlePostX}
              disabled={!text.trim() || xOver || sendingX}
              className="flex-1 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendingX ? '⏳ Postando...' : '🐦 Postar no X'}
            </button>
          </div>
          {xOver && (
            <p className="text-xs text-text-muted text-center">O botão X está desativado pois o texto excede 280 chars. Poste só no Telegram ou reduza o texto.</p>
          )}
        </div>

        {/* ── PREVIEW ─────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-5 sticky top-6">
            <h2 className="font-semibold text-text-primary text-sm">👁️ Preview em tempo real</h2>

            <div className="space-y-2">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">🐦 Como vai aparecer no X</p>
              <XPreview text={text} imageUrl={imageUrl} />
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">📱 Como vai aparecer no Telegram</p>
              <TelegramPreview text={text} imageUrl={imageUrl} />
            </div>

            {/* Info de chars */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className={cn(
                'rounded-lg p-3 text-center border',
                xOver ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'
              )}>
                <p className="text-xs text-text-muted">X (Twitter)</p>
                <p className={cn('text-lg font-bold', xOver ? 'text-red-400' : 'text-green-400')}>
                  {charCount}/{X_LIMIT}
                </p>
                <p className="text-xs text-text-muted">{xOver ? '❌ Muito longo' : '✅ OK'}</p>
              </div>
              <div className="rounded-lg p-3 text-center border border-green-500/30 bg-green-500/5">
                <p className="text-xs text-text-muted">Telegram</p>
                <p className="text-lg font-bold text-green-400">{charCount}</p>
                <p className="text-xs text-text-muted">✅ Sem limite</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
