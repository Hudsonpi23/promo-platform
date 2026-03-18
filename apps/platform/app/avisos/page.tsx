'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { fetchWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'aviso' | 'enquete' | 'metricas';

export default function AvisosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('aviso');

  // ── ABA 1: Post livre ────────────────────────────────────────────────────
  const [freeText, setFreeText] = useState('');
  const [sendingX, setSendingX] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);

  const charCount = freeText.length;
  const xLimit = 280;

  const handlePostX = async () => {
    if (!freeText.trim() || sendingX) return;
    setSendingX(true);
    try {
      const res = await fetchWithAuth('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText.trim() }),
      });
      const data = await res.json();
      if (data.success || data.tweetUrl) {
        alert(`✅ Postado no X!\n\n🔗 ${data.tweetUrl || 'Tweet criado'}`);
        setFreeText('');
      } else {
        alert(`❌ Erro no X:\n${data.error || 'Erro desconhecido'}`);
      }
    } catch (e: any) {
      alert(`❌ Erro:\n${e.message}`);
    } finally {
      setSendingX(false);
    }
  };

  const handlePostTelegram = async () => {
    if (!freeText.trim() || sendingTelegram) return;
    setSendingTelegram(true);
    try {
      const res = await fetchWithAuth('/api/telegram/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Enviado no Telegram!\n📱 Message ID: ${data.messageId}`);
        setFreeText('');
      } else {
        alert(`❌ Erro no Telegram:\n${data.error || 'Erro desconhecido'}`);
      }
    } catch (e: any) {
      alert(`❌ Erro:\n${e.message}`);
    } finally {
      setSendingTelegram(false);
    }
  };

  // ── ABA 2: Enquete ───────────────────────────────────────────────────────
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '', '']);
  const [sendingPoll, setSendingPoll] = useState(false);

  const updatePollOption = (i: number, val: string) => {
    const opts = [...pollOptions];
    opts[i] = val;
    setPollOptions(opts);
  };

  const validOptions = pollOptions.filter(o => o.trim().length > 0);

  const handlePostPoll = async () => {
    if (!pollQuestion.trim() || validOptions.length < 2 || sendingPoll) return;
    setSendingPoll(true);
    try {
      // Monta o post de enquete como texto formatado para X
      const optLines = validOptions.map((o, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} ${o}`).join('\n');
      const text = `${pollQuestion.trim()}\n\n${optLines}\n\n👇 Responde nos comentários!`;

      if (text.length > xLimit) {
        alert(`⚠️ Texto da enquete muito longo (${text.length} chars). Reduza a pergunta ou as opções.`);
        setSendingPoll(false);
        return;
      }

      const res = await fetchWithAuth('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success || data.tweetUrl) {
        alert(`✅ Enquete postada no X!\n\n🔗 ${data.tweetUrl || 'Tweet criado'}`);
        setPollQuestion('');
        setPollOptions(['', '', '', '']);
      } else {
        alert(`❌ Erro:\n${data.error || 'Erro desconhecido'}`);
      }
    } catch (e: any) {
      alert(`❌ Erro:\n${e.message}`);
    } finally {
      setSendingPoll(false);
    }
  };

  // ── ABA 3: Métricas ──────────────────────────────────────────────────────
  const { data: metrics } = useSWR('/api/metrics/summary', fetcher);
  const [sendingMetricsX, setSendingMetricsX] = useState(false);
  const [sendingMetricsTg, setSendingMetricsTg] = useState(false);

  const buildMetricsText = () => {
    if (!metrics) return '';
    const tw = metrics.channelStats?.TWITTER;
    const tg = metrics.channelStats?.TELEGRAM;
    const lines = [
      '📊 MÉTRICAS DO CANAL — ESTA SEMANA',
      '',
      `📤 Posts publicados: ${metrics.postsThisWeek || 0}`,
      `💰 Desconto médio: ${metrics.avgDiscount || 0}%`,
      `💵 Economia gerada: R$ ${(metrics.totalSavings || 0).toFixed(2).replace('.', ',')}`,
      '',
    ];
    if (tw) lines.push(`🐦 X: ${tw.postsThisWeek || 0} posts esta semana`);
    if (tg) lines.push(`📱 Telegram: ${tg.postsThisWeek || 0} posts esta semana`);
    lines.push('');
    lines.push('Acompanhe nossas promoções diárias! 🔥');
    return lines.join('\n');
  };

  const metricsText = buildMetricsText();

  const handleShareMetricsX = async () => {
    if (!metricsText || sendingMetricsX) return;
    const text = metricsText.slice(0, xLimit);
    setSendingMetricsX(true);
    try {
      const res = await fetchWithAuth('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success || data.tweetUrl) {
        alert(`✅ Métricas postadas no X!\n🔗 ${data.tweetUrl || 'Tweet criado'}`);
      } else {
        alert(`❌ Erro:\n${data.error}`);
      }
    } catch (e: any) {
      alert(`❌ Erro:\n${e.message}`);
    } finally {
      setSendingMetricsX(false);
    }
  };

  const handleShareMetricsTg = async () => {
    if (!metricsText || sendingMetricsTg) return;
    setSendingMetricsTg(true);
    try {
      const res = await fetchWithAuth('/api/telegram/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: metricsText }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Métricas enviadas no Telegram!`);
      } else {
        alert(`❌ Erro:\n${data.error}`);
      }
    } catch (e: any) {
      alert(`❌ Erro:\n${e.message}`);
    } finally {
      setSendingMetricsTg(false);
    }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'aviso', label: 'Post Livre', icon: '📣' },
    { id: 'enquete', label: 'Enquete', icon: '🗳️' },
    { id: 'metricas', label: 'Métricas', icon: '📊' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">📣 Avisos e Publicações</h1>
        <p className="text-text-muted text-sm">Interaja com seus seguidores além das promoções</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all',
              activeTab === t.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text-primary'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA: Post livre ────────────────────────────────────────────── */}
      {activeTab === 'aviso' && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-text-primary">📣 Escreva um aviso ou mensagem</h2>
          <p className="text-xs text-text-muted">
            Use para avisar sobre sorteios, agradecimentos, anúncios, informar horários, ou qualquer mensagem para seus seguidores.
          </p>

          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            rows={6}
            maxLength={1000}
            placeholder={
              'Exemplos:\n• Bom dia! Hoje tem promoção especial de eletrônicos a partir das 20h 🔥\n• Sorteio encerrado! O ganhador foi... 🎉\n• Novidade: agora postamos também na Shopee!'
            }
            className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
          />

          <div className="flex items-center justify-between">
            <span className={cn('text-xs', charCount > xLimit ? 'text-error' : 'text-text-muted')}>
              {charCount} / {xLimit} chars para o X
            </span>
            <div className="flex gap-3">
              <button
                onClick={handlePostTelegram}
                disabled={!freeText.trim() || sendingTelegram}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingTelegram ? '⏳ Enviando...' : '📱 Telegram'}
              </button>
              <button
                onClick={handlePostX}
                disabled={!freeText.trim() || charCount > xLimit || sendingX}
                className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingX ? '⏳ Postando...' : '🐦 Postar no X'}
              </button>
            </div>
          </div>

          {charCount > xLimit && (
            <p className="text-xs text-error">
              ⚠️ Texto muito longo para o X ({charCount - xLimit} chars a mais). Reduza ou envie só para o Telegram.
            </p>
          )}

          {/* Sugestões rápidas */}
          <div>
            <p className="text-xs text-text-muted mb-2">💡 Sugestões rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Bom dia! Promoções imperdíveis chegando às 20h 🔥',
                'Sorteio em andamento! Siga e reposte para participar 🎁',
                'Hoje tem promoção especial de eletrônicos! Fique ligado 📱',
                'Obrigado pelos seguidores! Vocês são incríveis ❤️',
                'Nova categoria no canal: agora postamos tênis e calçados 👟',
              ].map(sug => (
                <button
                  key={sug}
                  onClick={() => setFreeText(sug)}
                  className="px-3 py-1 rounded-full text-xs border border-border text-text-muted hover:border-primary/50 hover:text-text-primary transition-all"
                >
                  {sug.slice(0, 40)}…
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: Enquete ────────────────────────────────────────────────── */}
      {activeTab === 'enquete' && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-text-primary">🗳️ Criar Enquete para Seguidores</h2>
          <p className="text-xs text-text-muted">
            Pergunte o que seus seguidores querem ver, quais nichos preferem, ou qualquer questão de engajamento.
            A enquete será postada como texto no X com as opções numeradas.
          </p>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Pergunta *</label>
            <input
              type="text"
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              maxLength={200}
              placeholder="Ex: Qual nicho você quer mais promoções?"
              className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-text-secondary">Opções (mínimo 2) *</label>
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-text-muted text-sm w-6">
                  {['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]}
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={e => updatePollOption(i, e.target.value)}
                  maxLength={50}
                  placeholder={['Eletrônicos', 'Moda e Calçados', 'Suplementos', 'Casa e Decoração'][i]}
                  className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            ))}
          </div>

          {/* Preview da enquete */}
          {pollQuestion.trim() && validOptions.length >= 2 && (
            <div className="p-4 rounded-lg bg-background border border-border">
              <p className="text-xs text-text-muted mb-2">👁️ Preview:</p>
              <p className="text-sm text-text-primary whitespace-pre-wrap font-mono">
                {pollQuestion.trim()}{'\n\n'}
                {validOptions.map((o, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} ${o}`).join('\n')}{'\n\n'}
                👇 Responde nos comentários!
              </p>
            </div>
          )}

          {/* Sugestões de enquetes */}
          <div>
            <p className="text-xs text-text-muted mb-2">💡 Enquetes sugeridas:</p>
            <div className="space-y-2">
              {[
                {
                  q: 'Qual nicho você quer mais promoções?',
                  opts: ['Eletrônicos 📱', 'Moda e Calçados 👟', 'Suplementos 💪', 'Casa e Decoração 🏠'],
                },
                {
                  q: 'Em qual horário você prefere receber as promoções?',
                  opts: ['Manhã (7h–10h)', 'Almoço (12h–14h)', 'Tarde (16h–18h)', 'Noite (20h–22h)'],
                },
                {
                  q: 'Qual plataforma você mais usa para comprar?',
                  opts: ['Amazon', 'Mercado Livre', 'Shopee', 'Outra'],
                },
              ].map(s => (
                <button
                  key={s.q}
                  onClick={() => {
                    setPollQuestion(s.q);
                    setPollOptions([...s.opts, ...Array(4 - s.opts.length).fill('')]);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border text-xs text-text-muted hover:border-primary/50 hover:text-text-primary transition-all"
                >
                  📋 {s.q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePostPoll}
              disabled={!pollQuestion.trim() || validOptions.length < 2 || sendingPoll}
              className="px-6 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingPoll ? '⏳ Postando...' : '🐦 Postar Enquete no X'}
            </button>
          </div>
        </div>
      )}

      {/* ── ABA: Métricas ───────────────────────────────────────────────── */}
      {activeTab === 'metricas' && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-text-primary">📊 Publicar Métricas do Canal</h2>
          <p className="text-xs text-text-muted">
            Compartilhe os números do canal com seus seguidores. Transparência gera confiança e engajamento.
          </p>

          {!metrics ? (
            <p className="text-text-muted text-sm">⏳ Carregando métricas...</p>
          ) : (
            <>
              {/* Preview do post de métricas */}
              <div className="p-4 rounded-lg bg-background border border-border">
                <p className="text-xs text-text-muted mb-2">👁️ Preview do post:</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap font-mono">{metricsText}</p>
              </div>

              {/* Cards de métricas */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Posts esta semana', value: metrics.postsThisWeek || 0, icon: '📤' },
                  { label: 'Total de posts', value: metrics.totalPosts || 0, icon: '📋' },
                  { label: 'Desconto médio', value: `${metrics.avgDiscount || 0}%`, icon: '💰' },
                  { label: 'Economia gerada', value: `R$ ${(metrics.totalSavings || 0).toFixed(0)}`, icon: '💵' },
                  { label: 'Posts no X', value: metrics.channelStats?.TWITTER?.postsThisWeek || 0, icon: '🐦' },
                  { label: 'Posts Telegram', value: metrics.channelStats?.TELEGRAM?.postsThisWeek || 0, icon: '📱' },
                ].map(m => (
                  <div key={m.label} className="bg-surface border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted">{m.icon} {m.label}</p>
                    <p className="text-lg font-bold text-text-primary">{m.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleShareMetricsTg}
                  disabled={sendingMetricsTg}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMetricsTg ? '⏳ Enviando...' : '📱 Enviar no Telegram'}
                </button>
                <button
                  onClick={handleShareMetricsX}
                  disabled={sendingMetricsX}
                  className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMetricsX ? '⏳ Postando...' : '🐦 Postar no X'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
