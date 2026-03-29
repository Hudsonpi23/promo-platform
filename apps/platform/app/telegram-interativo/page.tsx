'use client';

import { useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'mensagem' | 'enquete' | 'sorteio' | 'quiz' | 'gerador';

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'mensagem', label: 'Mensagem', icon: '💬', desc: 'Texto livre, avisos, agradecimentos' },
  { id: 'enquete', label: 'Enquete', icon: '📊', desc: 'Enquete interativa para seguidores' },
  { id: 'sorteio', label: 'Sorteio', icon: '🎁', desc: 'Anunciar sorteios e premiar seguidores' },
  { id: 'quiz', label: 'Quiz', icon: '🧠', desc: 'Perguntas interativas de engajamento' },
  { id: 'gerador', label: 'Gerador IA', icon: '🤖', desc: 'Gere posts criativos automaticamente' },
];

const QUICK_MESSAGES = [
  { label: 'Bom dia', text: 'Bom dia, pessoal! Hoje tem promoções imperdíveis chegando ao longo do dia. Fiquem ligados! 🔥' },
  { label: 'Agradecimento', text: 'Muito obrigado por fazerem parte deste canal! Cada seguidor conta e motiva a buscar os melhores preços para vocês. ❤️' },
  { label: 'Novidade', text: '📢 NOVIDADE NO CANAL!\n\nEstamos expandindo para novas categorias de produtos. Em breve, promoções de [CATEGORIA] também!\n\nO que vocês acham? Comentem!' },
  { label: 'Horário', text: '⏰ AVISO DE HORÁRIO\n\nNossas promoções são postadas nos seguintes horários:\n\n🌅 Manhã: 8h–10h\n☀️ Tarde: 14h–16h\n🌙 Noite: 20h–22h\n\nAtivem as notificações para não perder nada!' },
  { label: 'Dica compra', text: '💡 DICA DE ECONOMIA\n\nAntes de comprar, sempre:\n\n✅ Compare preços\n✅ Verifique o histórico de preço\n✅ Leia as avaliações\n✅ Confira se o frete é grátis\n✅ Acompanhe nosso canal!\n\nCompartilhe com quem precisa dessa dica! 🙏' },
  { label: 'Fim de semana', text: '🎉 BOM FIM DE SEMANA!\n\nHoje as promoções estão especialmente boas. Aproveitem para garantir aquele produto que estão de olho!\n\nDúvidas? Manda mensagem! 💬' },
];

const POLL_SUGGESTIONS = [
  { q: 'Qual nicho vocês querem mais promoções?', opts: ['Eletrônicos 📱', 'Moda e Calçados 👟', 'Suplementos 💪', 'Casa e Decoração 🏠'] },
  { q: 'Qual horário preferem receber promoções?', opts: ['Manhã (7h–10h)', 'Almoço (12h–14h)', 'Tarde (16h–18h)', 'Noite (20h–22h)'] },
  { q: 'Qual plataforma vocês mais usam?', opts: ['Amazon', 'Mercado Livre', 'Shopee', 'Magalu'] },
  { q: 'Faixa de preço preferida nas promos?', opts: ['Até R$50', 'R$50–R$150', 'R$150–R$500', 'Acima de R$500'] },
  { q: 'Preferem promos com desconto alto ou frete grátis?', opts: ['Desconto alto 💰', 'Frete grátis 🚚'] },
];

const SORTEIO_TEMPLATES = [
  {
    label: 'Sorteio PIX',
    text: '🏆 SORTEIO PIX — R$ [VALOR] 💸\n\nQuer ganhar? Participa agora!\n\nPara participar:\n✅ Seguir o canal\n✅ Curtir e repostar\n✅ Marcar 2 amigos\n\n📅 Sorteio: [DATA] às [HORA]\n\nBoa sorte a todos! 🍀',
  },
  {
    label: 'Sorteio Produto',
    text: '🎁 SORTEIO ESPECIAL!\n\nEstamos sorteando um(a) [PRODUTO]!\n\nComo participar:\n✅ Seguir a página\n✅ Curtir e repostar\n✅ Comentar "EU QUERO"\n\n📅 Resultado: [DATA]\n\nCompartilha para mais chances! 🚀',
  },
  {
    label: 'Resultado Sorteio',
    text: '🎉 RESULTADO DO SORTEIO!\n\nE o ganhador(a) é... [NOME]! 🥳\n\nParabéns! Entre em contato via DM para receber o prêmio.\n\nNão ganhou? Fique tranquilo, teremos mais sorteios em breve! 🍀\n\nObrigado a todos! ❤️',
  },
];

const QUIZ_TEMPLATES = [
  { label: 'Custo-benefício', q: 'Qual marca tem o melhor custo-benefício em smartphones?', opts: ['Samsung', 'Xiaomi', 'Motorola', 'Apple'] },
  { label: 'Verdade ou mito', q: 'Verdade ou mito: comprar na madrugada garante preço menor?', opts: ['Verdade ✅', 'Mito ❌'] },
  { label: 'Horário de desconto', q: 'Qual o melhor dia da semana para pegar descontos online?', opts: ['Segunda-feira', 'Quarta-feira', 'Sexta-feira', 'Domingo'] },
  { label: 'Preferência tech', q: 'Se pudesse escolher só UM gadget, qual seria?', opts: ['Fone Bluetooth 🎧', 'Smartwatch ⌚', 'Tablet 📱', 'Câmera 📷'] },
];

const AI_PROMPT_TYPES = [
  { id: 'engajamento', label: 'Engajamento', icon: '🔥', prompt: 'Crie uma mensagem curta e envolvente para engajar seguidores de um canal de promoções. Tom: informal, animado, com emojis. Máximo 250 caracteres.' },
  { id: 'dica', label: 'Dica de Economia', icon: '💡', prompt: 'Crie uma dica prática e curta de economia para consumidores brasileiros, com tom amigável e emojis. Máximo 250 caracteres.' },
  { id: 'curiosidade', label: 'Curiosidade', icon: '🤔', prompt: 'Crie um post curto "Você sabia?" com uma curiosidade sobre compras online ou descontos no Brasil. Tom: casual, com emojis. Máximo 250 caracteres.' },
  { id: 'bom_dia', label: 'Bom Dia/Noite', icon: '🌅', prompt: 'Crie uma mensagem curta de bom dia ou boa noite para um canal de promoções, com tom caloroso e motivador. Use emojis. Máximo 250 caracteres.' },
  { id: 'interacao', label: 'Pergunta aos Seguidores', icon: '💬', prompt: 'Crie uma pergunta curta e aberta para engajar seguidores de um canal de promoções. Algo que gere comentários. Use emojis. Máximo 250 caracteres.' },
  { id: 'meme', label: 'Meme / Humor', icon: '😂', prompt: 'Crie um post curto e engraçado sobre compras impulsivas ou a espera pelo frete. Tom: meme, informal, com emojis. Máximo 250 caracteres.' },
];

// ── Preview components ──────────────────────────────────────────────────────

function TelegramPreview({ text, isPoll, pollQuestion, pollOptions }: {
  text: string;
  isPoll?: boolean;
  pollQuestion?: string;
  pollOptions?: string[];
}) {
  return (
    <div className="bg-[#212d3b] rounded-2xl p-4 font-sans">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs shrink-0">M</div>
        <span className="text-[#6ab3f3] font-semibold text-sm">Manu das Promoções</span>
      </div>
      {isPoll && pollQuestion ? (
        <div className="space-y-2">
          <p className="text-[#e4e6ea] text-sm font-medium">{pollQuestion}</p>
          <div className="space-y-1.5 mt-3">
            {(pollOptions || []).filter(o => o.trim()).map((opt, i) => (
              <div key={i} className="bg-[#2b3d4f] rounded-lg px-3 py-2 text-[#6ab3f3] text-sm">
                {opt}
              </div>
            ))}
          </div>
          <p className="text-[#7d8e9e] text-xs mt-2">📊 Enquete anônima</p>
        </div>
      ) : (
        <p className="text-[#e4e6ea] text-sm whitespace-pre-wrap break-words leading-relaxed">
          {text || <span className="text-gray-600 italic">Seu post vai aparecer aqui...</span>}
        </p>
      )}
      <div className="mt-2 text-right text-[#7d8e9e] text-xs">
        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function XPreview({ text }: { text: string }) {
  return (
    <div className="bg-black border border-gray-700 rounded-2xl p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">M</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-white font-bold text-sm">Manu Promoções</span>
            <span className="text-gray-500 text-sm">@manupromocao · agora</span>
          </div>
          <p className="text-white text-sm whitespace-pre-wrap break-words leading-relaxed">
            {text || <span className="text-gray-600 italic">Seu post vai aparecer aqui...</span>}
          </p>
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

// ── Send buttons component ──────────────────────────────────────────────────

function SendButtons({ text, onSendTelegram, onSendX, sendingTg, sendingX, disabled }: {
  text: string;
  onSendTelegram: () => void;
  onSendX: () => void;
  sendingTg: boolean;
  sendingX: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onSendTelegram}
        disabled={disabled || !text.trim() || sendingTg}
        className="flex-1 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sendingTg ? '⏳ Enviando...' : '📱 Telegram'}
      </button>
      <button
        onClick={onSendX}
        disabled={disabled || !text.trim() || sendingX}
        className="flex-1 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sendingX ? '⏳ Postando...' : '🐦 X (Twitter)'}
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PostsInterativosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('mensagem');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Mensagem livre
  const [msgText, setMsgText] = useState('');
  const [sendingMsgTg, setSendingMsgTg] = useState(false);
  const [sendingMsgX, setSendingMsgX] = useState(false);

  // Enquete
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '', '']);
  const [pollAnonymous, setPollAnonymous] = useState(true);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [sendingPollTg, setSendingPollTg] = useState(false);
  const [sendingPollX, setSendingPollX] = useState(false);

  // Sorteio
  const [sorteioText, setSorteioText] = useState('');
  const [sendingSorteioTg, setSendingSorteioTg] = useState(false);
  const [sendingSorteioX, setSendingSorteioX] = useState(false);

  // Quiz
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptions, setQuizOptions] = useState(['', '', '', '']);
  const [sendingQuizTg, setSendingQuizTg] = useState(false);
  const [sendingQuizX, setSendingQuizX] = useState(false);

  // Gerador IA
  const [aiPromptType, setAiPromptType] = useState('engajamento');
  const [aiCustomContext, setAiCustomContext] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [sendingAITg, setSendingAITg] = useState(false);
  const [sendingAIX, setSendingAIX] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  // ── Helpers: post to Telegram and X ────────────────────────────────────
  const postToTelegram = async (text: string) => {
    const res = await fetchWithAuth('/api/telegram/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });
    return res.json();
  };

  const postToX = async (text: string) => {
    const res = await fetchWithAuth('/api/twitter/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });
    return res.json();
  };

  const postPollToTelegram = async (question: string, options: string[], isAnonymous: boolean, allowsMultiple: boolean) => {
    const res = await fetchWithAuth('/api/telegram/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: options.map(o => o.trim()), isAnonymous, allowsMultipleAnswers: allowsMultiple }),
    });
    return res.json();
  };

  const formatPollAsText = (question: string, options: string[]) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = options.map((o, i) => `${emojis[i] || `${i + 1}.`} ${o}`).join('\n');
    return `${question.trim()}\n\n${lines}\n\n👇 Responde nos comentários!`;
  };

  // ── Mensagem handlers ──────────────────────────────────────────────────
  const handleSendMsgTg = async () => {
    if (!msgText.trim() || sendingMsgTg) return;
    setSendingMsgTg(true);
    try {
      const data = await postToTelegram(msgText);
      if (data.success) { showFeedback('success', `Telegram: enviado! ID ${data.messageId}`); setMsgText(''); }
      else showFeedback('error', data.error || 'Erro ao enviar no Telegram');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingMsgTg(false); }
  };

  const handleSendMsgX = async () => {
    if (!msgText.trim() || sendingMsgX) return;
    setSendingMsgX(true);
    try {
      const data = await postToX(msgText);
      if (data.success || data.tweetUrl) { showFeedback('success', `X: postado! ${data.tweetUrl || ''}`); setMsgText(''); }
      else showFeedback('error', data.error || 'Erro ao postar no X');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingMsgX(false); }
  };

  // ── Enquete handlers ──────────────────────────────────────────────────
  const validPollOpts = pollOptions.filter(o => o.trim().length > 0);

  const handleSendPollTg = async () => {
    if (!pollQuestion.trim() || validPollOpts.length < 2 || sendingPollTg) return;
    setSendingPollTg(true);
    try {
      const data = await postPollToTelegram(pollQuestion, validPollOpts, pollAnonymous, pollMultiple);
      if (data.success) { showFeedback('success', `Telegram: enquete enviada!`); setPollQuestion(''); setPollOptions(['', '', '', '']); }
      else showFeedback('error', data.error || 'Erro ao enviar enquete');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingPollTg(false); }
  };

  const handleSendPollX = async () => {
    if (!pollQuestion.trim() || validPollOpts.length < 2 || sendingPollX) return;
    setSendingPollX(true);
    try {
      const text = formatPollAsText(pollQuestion, validPollOpts);
      const data = await postToX(text);
      if (data.success || data.tweetUrl) { showFeedback('success', `X: enquete postada! ${data.tweetUrl || ''}`); setPollQuestion(''); setPollOptions(['', '', '', '']); }
      else showFeedback('error', data.error || 'Erro ao postar enquete no X');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingPollX(false); }
  };

  // ── Sorteio handlers ──────────────────────────────────────────────────
  const handleSendSorteioTg = async () => {
    if (!sorteioText.trim() || sendingSorteioTg) return;
    setSendingSorteioTg(true);
    try {
      const data = await postToTelegram(sorteioText);
      if (data.success) { showFeedback('success', `Telegram: sorteio publicado!`); setSorteioText(''); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingSorteioTg(false); }
  };

  const handleSendSorteioX = async () => {
    if (!sorteioText.trim() || sendingSorteioX) return;
    setSendingSorteioX(true);
    try {
      const data = await postToX(sorteioText);
      if (data.success || data.tweetUrl) { showFeedback('success', `X: sorteio postado! ${data.tweetUrl || ''}`); setSorteioText(''); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingSorteioX(false); }
  };

  // ── Quiz handlers ─────────────────────────────────────────────────────
  const validQuizOpts = quizOptions.filter(o => o.trim().length > 0);

  const handleSendQuizTg = async () => {
    if (!quizQuestion.trim() || validQuizOpts.length < 2 || sendingQuizTg) return;
    setSendingQuizTg(true);
    try {
      const data = await postPollToTelegram(quizQuestion, validQuizOpts, true, false);
      if (data.success) { showFeedback('success', `Telegram: quiz enviado!`); setQuizQuestion(''); setQuizOptions(['', '', '', '']); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingQuizTg(false); }
  };

  const handleSendQuizX = async () => {
    if (!quizQuestion.trim() || validQuizOpts.length < 2 || sendingQuizX) return;
    setSendingQuizX(true);
    try {
      const text = formatPollAsText(quizQuestion, validQuizOpts);
      const data = await postToX(text);
      if (data.success || data.tweetUrl) { showFeedback('success', `X: quiz postado! ${data.tweetUrl || ''}`); setQuizQuestion(''); setQuizOptions(['', '', '', '']); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingQuizX(false); }
  };

  // ── Gerador IA handlers ───────────────────────────────────────────────
  const handleGenerateAI = async () => {
    setGeneratingAI(true);
    setFeedback(null);
    setAiResult('');
    const selected = AI_PROMPT_TYPES.find(p => p.id === aiPromptType);
    const fullPrompt = (selected?.prompt || '') + (aiCustomContext.trim() ? `\n\nContexto: ${aiCustomContext.trim()}` : '') + '\n\nResponda APENAS com o texto do post, sem explicações.';
    try {
      const res = await fetchWithAuth('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, maxTokens: 300 }),
      });
      const data = await res.json();
      if (data.text) setAiResult(data.text);
      else { setAiResult(generateLocalPost(aiPromptType)); showFeedback('success', 'Gerado localmente (IA indisponível)'); }
    } catch {
      setAiResult(generateLocalPost(aiPromptType));
      showFeedback('success', 'Gerado localmente (IA indisponível)');
    } finally { setGeneratingAI(false); }
  };

  const handleSendAITg = async () => {
    if (!aiResult.trim() || sendingAITg) return;
    setSendingAITg(true);
    try {
      const data = await postToTelegram(aiResult);
      if (data.success) { showFeedback('success', `Telegram: enviado!`); setAiResult(''); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingAITg(false); }
  };

  const handleSendAIX = async () => {
    if (!aiResult.trim() || sendingAIX) return;
    setSendingAIX(true);
    try {
      const data = await postToX(aiResult);
      if (data.success || data.tweetUrl) { showFeedback('success', `X: postado! ${data.tweetUrl || ''}`); setAiResult(''); }
      else showFeedback('error', data.error || 'Erro');
    } catch (e: any) { showFeedback('error', e.message); }
    finally { setSendingAIX(false); }
  };

  // ── Poll option helpers ───────────────────────────────────────────────
  const updatePollOption = (i: number, val: string) => { const o = [...pollOptions]; o[i] = val; setPollOptions(o); };
  const updateQuizOption = (i: number, val: string) => { const o = [...quizOptions]; o[i] = val; setQuizOptions(o); };
  const addPollOption = () => { if (pollOptions.length < 10) setPollOptions([...pollOptions, '']); };
  const removePollOption = (i: number) => { if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i)); };
  const addQuizOption = () => { if (quizOptions.length < 10) setQuizOptions([...quizOptions, '']); };
  const removeQuizOption = (i: number) => { if (quizOptions.length > 2) setQuizOptions(quizOptions.filter((_, idx) => idx !== i)); };

  // ── Preview text resolution ───────────────────────────────────────────
  const currentPreviewText = activeTab === 'mensagem' ? msgText
    : activeTab === 'sorteio' ? sorteioText
    : activeTab === 'gerador' ? aiResult
    : activeTab === 'enquete' ? formatPollAsText(pollQuestion, validPollOpts)
    : activeTab === 'quiz' ? formatPollAsText(quizQuestion, validQuizOpts)
    : '';

  const isPollPreview = activeTab === 'enquete' || activeTab === 'quiz';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">🎯 Posts Interativos</h1>
        <p className="text-text-muted text-sm">
          Engajamento e interação com seguidores — Telegram + X (Twitter)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setFeedback(null); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap',
              activeTab === t.id
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'border-border text-text-muted hover:border-primary/30 hover:text-text-primary'
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Feedback global */}
      {feedback && (
        <div className={cn(
          'px-4 py-3 rounded-xl text-sm font-medium',
          feedback.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        )}>
          {feedback.type === 'success' ? '✅' : '❌'} {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ══ COLUNA PRINCIPAL (2/3) ══════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">

          {/* ═══ MENSAGEM LIVRE ═══════════════════════════════════════ */}
          {activeTab === 'mensagem' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-text-primary">💬 Mensagem Livre</h2>
                <p className="text-xs text-text-muted">
                  Envie para Telegram, X ou ambos. Avisos, agradecimentos, dicas, bom dia...
                </p>
                <textarea
                  ref={textareaRef}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  rows={7}
                  maxLength={4096}
                  placeholder="Escreva sua mensagem para os seguidores..."
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{msgText.length} caracteres</span>
                </div>
                <SendButtons text={msgText} onSendTelegram={handleSendMsgTg} onSendX={handleSendMsgX} sendingTg={sendingMsgTg} sendingX={sendingMsgX} />
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">⚡ Mensagens Rápidas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QUICK_MESSAGES.map(qm => (
                    <button
                      key={qm.label}
                      onClick={() => setMsgText(qm.text)}
                      className="text-left px-3 py-2.5 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary hover:bg-primary/5 transition-all"
                    >
                      <span className="font-medium text-text-secondary">{qm.label}</span>
                      <p className="mt-1 line-clamp-2 opacity-70">{qm.text.slice(0, 60)}...</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ ENQUETE ══════════════════════════════════════════════ */}
          {activeTab === 'enquete' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-text-primary">📊 Enquete Interativa</h2>
                <p className="text-xs text-text-muted">
                  No Telegram: enquete nativa com botões. No X: post com opções numeradas.
                </p>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Pergunta *</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    maxLength={300}
                    placeholder="Ex: Qual nicho vocês querem mais promoções?"
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-text-secondary">Opções (2–10) *</label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-text-muted text-xs w-5 text-right">{i + 1}.</span>
                      <input type="text" value={opt} onChange={e => updatePollOption(i, e.target.value)} maxLength={100} placeholder={`Opção ${i + 1}`}
                        className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removePollOption(i)} className="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <button onClick={addPollOption} className="text-xs text-primary hover:text-primary/80 transition-colors">+ Adicionar opção</button>
                  )}
                </div>

                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={pollAnonymous} onChange={e => setPollAnonymous(e.target.checked)} className="rounded" />
                    Voto anônimo (Telegram)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={pollMultiple} onChange={e => setPollMultiple(e.target.checked)} className="rounded" />
                    Múltiplas respostas (Telegram)
                  </label>
                </div>

                <SendButtons
                  text={pollQuestion}
                  onSendTelegram={handleSendPollTg}
                  onSendX={handleSendPollX}
                  sendingTg={sendingPollTg}
                  sendingX={sendingPollX}
                  disabled={validPollOpts.length < 2}
                />
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">💡 Enquetes Sugeridas</h3>
                <div className="space-y-2">
                  {POLL_SUGGESTIONS.map(s => (
                    <button
                      key={s.q}
                      onClick={() => { setPollQuestion(s.q); setPollOptions([...s.opts, ...Array(Math.max(0, 4 - s.opts.length)).fill('')].slice(0, Math.max(4, s.opts.length))); }}
                      className="w-full text-left px-4 py-3 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary hover:bg-primary/5 transition-all"
                    >
                      <span className="text-primary font-medium">📋</span> {s.q}
                      <span className="text-text-muted ml-2">({s.opts.length} opções)</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SORTEIO ═════════════════════════════════════════════ */}
          {activeTab === 'sorteio' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-text-primary">🎁 Publicar Sorteio</h2>
                <p className="text-xs text-text-muted">
                  Anuncie sorteios para engajar e premiar seus seguidores em ambos os canais.
                </p>
                <textarea
                  value={sorteioText}
                  onChange={e => setSorteioText(e.target.value)}
                  rows={10}
                  maxLength={4096}
                  placeholder="Use um template abaixo como ponto de partida..."
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{sorteioText.length} caracteres</span>
                </div>
                <SendButtons text={sorteioText} onSendTelegram={handleSendSorteioTg} onSendX={handleSendSorteioX} sendingTg={sendingSorteioTg} sendingX={sendingSorteioX} />
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">📋 Templates de Sorteio</h3>
                <div className="space-y-2">
                  {SORTEIO_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setSorteioText(t.text)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary hover:bg-primary/5 transition-all"
                    >
                      <span className="text-primary font-medium">{t.label}</span>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap">{t.text.slice(0, 100)}...</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ QUIZ ════════════════════════════════════════════════ */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-text-primary">🧠 Quiz Interativo</h2>
                <p className="text-xs text-text-muted">
                  No Telegram: enquete nativa. No X: post com opções numeradas.
                </p>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Pergunta do Quiz *</label>
                  <input type="text" value={quizQuestion} onChange={e => setQuizQuestion(e.target.value)} maxLength={300}
                    placeholder="Ex: Qual marca tem o melhor custo-benefício?"
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-text-secondary">Opções (2–10) *</label>
                  {quizOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-text-muted text-xs w-5 text-right">{i + 1}.</span>
                      <input type="text" value={opt} onChange={e => updateQuizOption(i, e.target.value)} maxLength={100} placeholder={`Opção ${i + 1}`}
                        className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                      {quizOptions.length > 2 && (
                        <button onClick={() => removeQuizOption(i)} className="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
                      )}
                    </div>
                  ))}
                  {quizOptions.length < 10 && (
                    <button onClick={addQuizOption} className="text-xs text-primary hover:text-primary/80 transition-colors">+ Adicionar opção</button>
                  )}
                </div>

                <SendButtons
                  text={quizQuestion}
                  onSendTelegram={handleSendQuizTg}
                  onSendX={handleSendQuizX}
                  sendingTg={sendingQuizTg}
                  sendingX={sendingQuizX}
                  disabled={validQuizOpts.length < 2}
                />
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">💡 Quizzes Sugeridos</h3>
                <div className="space-y-2">
                  {QUIZ_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => { setQuizQuestion(t.q); setQuizOptions([...t.opts, ...Array(Math.max(0, 4 - t.opts.length)).fill('')].slice(0, Math.max(4, t.opts.length))); }}
                      className="w-full text-left px-4 py-3 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary hover:bg-primary/5 transition-all"
                    >
                      <span className="text-primary font-medium">🧠 {t.label}</span>
                      <p className="mt-1">{t.q}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ GERADOR IA ═══════════════════════════════════════════ */}
          {activeTab === 'gerador' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-text-primary">🤖 Gerador de Posts com IA</h2>
                <p className="text-xs text-text-muted">
                  Gere posts criativos automaticamente. Edite antes de enviar para Telegram ou X.
                </p>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Tipo de Post</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AI_PROMPT_TYPES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setAiPromptType(p.id)}
                        className={cn(
                          'px-3 py-2.5 rounded-lg text-sm font-medium border transition-all text-left',
                          aiPromptType === p.id
                            ? 'bg-primary/20 text-primary border-primary/30'
                            : 'border-border text-text-muted hover:border-primary/30 hover:text-text-primary'
                        )}
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Contexto extra (opcional)</label>
                  <input type="text" value={aiCustomContext} onChange={e => setAiCustomContext(e.target.value)} maxLength={200}
                    placeholder="Ex: Estamos com 500 seguidores, semana de Black Friday..."
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>

                <button
                  onClick={handleGenerateAI}
                  disabled={generatingAI}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold text-sm transition-all disabled:opacity-40"
                >
                  {generatingAI ? '⏳ Gerando...' : '🤖 Gerar Post'}
                </button>

                {aiResult && (
                  <div className="space-y-3">
                    <label className="block text-sm text-text-secondary">Resultado (edite se quiser)</label>
                    <textarea
                      value={aiResult}
                      onChange={e => setAiResult(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none leading-relaxed"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateAI}
                        disabled={generatingAI}
                        className="px-4 py-2.5 rounded-xl border border-border text-text-muted hover:border-primary/50 hover:text-text-primary text-sm font-medium transition-all"
                      >
                        🔄 Gerar outro
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={handleSendAITg}
                        disabled={!aiResult.trim() || sendingAITg}
                        className="px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-semibold text-sm transition-all disabled:opacity-40"
                      >
                        {sendingAITg ? '⏳...' : '📱 Telegram'}
                      </button>
                      <button
                        onClick={handleSendAIX}
                        disabled={!aiResult.trim() || sendingAIX}
                        className="px-5 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-sm transition-all disabled:opacity-40"
                      >
                        {sendingAIX ? '⏳...' : '🐦 X'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ COLUNA PREVIEW (1/3) ═══════════════════════════════════ */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-5 sticky top-6">
            <h2 className="font-semibold text-text-primary text-sm">👁️ Preview em Tempo Real</h2>

            {/* Telegram Preview */}
            <div className="space-y-2">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">📱 Telegram</p>
              <TelegramPreview
                text={currentPreviewText}
                isPoll={isPollPreview}
                pollQuestion={activeTab === 'enquete' ? pollQuestion : quizQuestion}
                pollOptions={activeTab === 'enquete' ? pollOptions : quizOptions}
              />
            </div>

            {/* X Preview */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">🐦 X (Twitter)</p>
              <XPreview text={currentPreviewText} />
            </div>

            {/* Stats */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Aba</span>
                <span className="text-primary font-medium">{TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Caracteres</span>
                <span className="text-text-primary font-medium">{currentPreviewText.length}</span>
              </div>
              {isPollPreview && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Opções válidas</span>
                  <span className="text-text-primary font-medium">{activeTab === 'enquete' ? validPollOpts.length : validQuizOpts.length}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-xs text-text-muted leading-relaxed">
                {activeTab === 'mensagem' && '💡 Posts de engajamento curtos performam melhor em ambas as plataformas.'}
                {activeTab === 'enquete' && '💡 Telegram: enquete nativa com botões. X: post com opções numeradas nos comentários.'}
                {activeTab === 'sorteio' && '💡 Sorteios são a melhor forma de atrair novos seguidores em qualquer plataforma.'}
                {activeTab === 'quiz' && '💡 Quizzes geram curiosidade e interação — excelentes para engajamento.'}
                {activeTab === 'gerador' && '💡 A IA gera o texto base — edite e personalize antes de enviar.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateLocalPost(type: string): string {
  const posts: Record<string, string[]> = {
    engajamento: [
      '🔥 E aí, galera! Quem está de olho em algum produto? Comenta aqui que eu vou atrás do melhor preço pra vocês! 💪\n\nBora economizar juntos! 🛒',
      '⚡ Hoje já postamos promos incríveis e ainda tem mais!\n\nAtivaram as notificações? Ativa agora! 🔔',
    ],
    dica: [
      '💡 DICA DE ECONOMIA\n\nAntes de comprar online:\n✅ Compare em 3 sites\n✅ Veja o histórico de preço\n✅ Procure cupons\n✅ Acompanhe nosso canal!\n\nCompartilha! 🙏',
    ],
    curiosidade: [
      '🤔 VOCÊ SABIA?\n\nA maioria das lojas muda os preços até 3x por dia! Por isso é bom acompanhar um canal de promoções 📊\n\nJá pegou promo boa aqui? Conta! 👇',
    ],
    bom_dia: [
      '🌅 Bom dia, pessoal!\n\nMais um dia de caça às melhores promoções! Fiquem ligados que hoje promete! 🔥\n\nBom dia e boas compras! 🛒',
    ],
    interacao: [
      '💬 PERGUNTA DO DIA!\n\nSe pudesse ter promo TODO DIA de UMA categoria, qual seria?\n\n📱 Eletrônicos\n👟 Moda\n🏠 Casa\n🎮 Games\n\nComenta! 👇',
    ],
    meme: [
      '😂 Eu: "Esse mês não vou comprar nada."\n\nEu vendo 60% OFF:\n💳💳💳💳💳\n\nQuem se identifica? 😅\n\nMarca aquele amigo que não resiste! 👇',
    ],
  };
  const options = posts[type] || posts.engajamento;
  return options[Math.floor(Math.random() * options.length)];
}
