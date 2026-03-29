/**
 * Twitter/X Metrics Service — Leitura de dados via API v2 (Pay-Per-Use)
 *
 * Custo por operação:
 * - Post read: $0.005
 * - User lookup: $0.01
 * - Interações (like/follow/retweet): $0.015
 *
 * Autenticação: OAuth 1.0a (mesmas credenciais usadas para posting)
 */

import crypto from 'crypto';

// ==================== CONFIG ====================

const API_KEY = process.env.TWITTER_API_KEY || '';
const API_SECRET = process.env.TWITTER_API_SECRET || '';
const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

const API_BASE = 'https://api.twitter.com/2';

// ==================== TYPES ====================

export interface TweetMetrics {
  tweetId: string;
  text: string;
  createdAt: string;
  publicMetrics: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    bookmarkCount: number;
    impressionCount: number;
  };
  editHistoryTweetIds?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  description: string;
  profileImageUrl: string;
  publicMetrics: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
  };
  verified: boolean;
  createdAt: string;
}

export interface TimelineResult {
  tweets: TweetMetrics[];
  meta: {
    resultCount: number;
    nextToken?: string;
    oldestId?: string;
    newestId?: string;
  };
}

// ==================== OAUTH ====================

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const base = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(API_SECRET)}&${encodeURIComponent(ACCESS_TOKEN_SECRET)}`;
  return crypto.createHmac('sha1', signingKey).update(base).digest('base64');
}

function buildAuthHeader(method: string, url: string, queryParams: Record<string, string> = {}): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...queryParams };
  oauthParams.oauth_signature = generateSignature(method, url, allParams);

  const header = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

export function isTwitterMetricsConfigured(): boolean {
  return !!(API_KEY && API_SECRET && ACCESS_TOKEN && ACCESS_TOKEN_SECRET);
}

// ==================== HELPERS ====================

async function twitterGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const baseUrl = `${API_BASE}${endpoint}`;
  const qs = new URLSearchParams(params).toString();
  const fullUrl = qs ? `${baseUrl}?${qs}` : baseUrl;

  const authHeader = buildAuthHeader('GET', baseUrl, params);

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: { Authorization: authHeader },
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = (data as any)?.detail || (data as any)?.title || `HTTP ${res.status}`;
    console.error(`[X Metrics] Erro ${endpoint}:`, errMsg);
    throw new Error(errMsg);
  }

  return data;
}

function parseTweet(tweet: any, includes?: any): TweetMetrics {
  return {
    tweetId: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at || '',
    publicMetrics: {
      retweetCount: tweet.public_metrics?.retweet_count ?? 0,
      replyCount: tweet.public_metrics?.reply_count ?? 0,
      likeCount: tweet.public_metrics?.like_count ?? 0,
      quoteCount: tweet.public_metrics?.quote_count ?? 0,
      bookmarkCount: tweet.public_metrics?.bookmark_count ?? 0,
      impressionCount: tweet.public_metrics?.impression_count ?? 0,
    },
    editHistoryTweetIds: tweet.edit_history_tweet_ids,
  };
}

// ==================== PUBLIC API ====================

/**
 * Busca o perfil autenticado (o nosso — @manupromocao)
 */
export async function getMyProfile(): Promise<UserProfile> {
  console.log('[X Metrics] Buscando perfil autenticado...');

  const data = await twitterGet('/users/me', {
    'user.fields': 'id,name,username,description,profile_image_url,public_metrics,verified,created_at',
  });

  const u = data.data;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    description: u.description || '',
    profileImageUrl: u.profile_image_url || '',
    publicMetrics: {
      followersCount: u.public_metrics?.followers_count ?? 0,
      followingCount: u.public_metrics?.following_count ?? 0,
      tweetCount: u.public_metrics?.tweet_count ?? 0,
      listedCount: u.public_metrics?.listed_count ?? 0,
    },
    verified: u.verified || false,
    createdAt: u.created_at || '',
  };
}

/**
 * Busca métricas de tweets específicos por IDs
 */
export async function getTweetMetrics(tweetIds: string[]): Promise<TweetMetrics[]> {
  if (tweetIds.length === 0) return [];
  if (tweetIds.length > 100) tweetIds = tweetIds.slice(0, 100);

  console.log(`[X Metrics] Buscando métricas de ${tweetIds.length} tweet(s)...`);

  const data = await twitterGet('/tweets', {
    ids: tweetIds.join(','),
    'tweet.fields': 'id,text,created_at,public_metrics,edit_history_tweet_ids',
  });

  const tweets = data.data || [];
  return tweets.map((t: any) => parseTweet(t));
}

/**
 * Busca a timeline do usuário autenticado (últimos tweets)
 */
export async function getMyTimeline(options?: {
  maxResults?: number;
  paginationToken?: string;
  sinceId?: string;
  untilId?: string;
}): Promise<TimelineResult> {
  const profile = await getMyProfile();

  console.log(`[X Metrics] Buscando timeline de @${profile.username}...`);

  const params: Record<string, string> = {
    'tweet.fields': 'id,text,created_at,public_metrics',
    'max_results': String(Math.min(options?.maxResults || 20, 100)),
  };

  if (options?.paginationToken) params.pagination_token = options.paginationToken;
  if (options?.sinceId) params.since_id = options.sinceId;
  if (options?.untilId) params.until_id = options.untilId;

  const data = await twitterGet(`/users/${profile.id}/tweets`, params);

  const tweets = (data.data || []).map((t: any) => parseTweet(t));

  return {
    tweets,
    meta: {
      resultCount: data.meta?.result_count ?? tweets.length,
      nextToken: data.meta?.next_token,
      oldestId: data.meta?.oldest_id,
      newestId: data.meta?.newest_id,
    },
  };
}

/**
 * Busca menções ao usuário autenticado
 */
export async function getMyMentions(options?: {
  maxResults?: number;
  paginationToken?: string;
  sinceId?: string;
}): Promise<TimelineResult> {
  const profile = await getMyProfile();

  console.log(`[X Metrics] Buscando menções de @${profile.username}...`);

  const params: Record<string, string> = {
    'tweet.fields': 'id,text,created_at,public_metrics',
    'max_results': String(Math.min(options?.maxResults || 20, 100)),
  };

  if (options?.paginationToken) params.pagination_token = options.paginationToken;
  if (options?.sinceId) params.since_id = options.sinceId;

  const data = await twitterGet(`/users/${profile.id}/mentions`, params);

  const tweets = (data.data || []).map((t: any) => parseTweet(t));

  return {
    tweets,
    meta: {
      resultCount: data.meta?.result_count ?? tweets.length,
      nextToken: data.meta?.next_token,
      oldestId: data.meta?.oldest_id,
      newestId: data.meta?.newest_id,
    },
  };
}

/**
 * Busca tweets recentes com uma query (7 dias)
 */
export async function searchRecentTweets(query: string, options?: {
  maxResults?: number;
  paginationToken?: string;
}): Promise<TimelineResult> {
  console.log(`[X Metrics] Buscando tweets: "${query}"...`);

  const params: Record<string, string> = {
    query,
    'tweet.fields': 'id,text,created_at,public_metrics',
    'max_results': String(Math.min(options?.maxResults || 10, 100)),
  };

  if (options?.paginationToken) params.pagination_token = options.paginationToken;

  const data = await twitterGet('/tweets/search/recent', params);

  const tweets = (data.data || []).map((t: any) => parseTweet(t));

  return {
    tweets,
    meta: {
      resultCount: data.meta?.result_count ?? tweets.length,
      nextToken: data.meta?.next_token,
      oldestId: data.meta?.oldest_id,
      newestId: data.meta?.newest_id,
    },
  };
}

/**
 * Resumo de performance: top tweets, médias, totais
 */
export async function getPerformanceSummary(maxTweets: number = 50): Promise<{
  profile: UserProfile;
  totalTweets: number;
  avgImpressions: number;
  avgLikes: number;
  avgReplies: number;
  avgRetweets: number;
  topByImpressions: TweetMetrics[];
  topByLikes: TweetMetrics[];
  topByReplies: TweetMetrics[];
  recentTweets: TweetMetrics[];
}> {
  const profile = await getMyProfile();

  let allTweets: TweetMetrics[] = [];
  let nextToken: string | undefined;
  let fetched = 0;

  while (fetched < maxTweets) {
    const batchSize = Math.min(maxTweets - fetched, 100);
    const params: Record<string, string> = {
      'tweet.fields': 'id,text,created_at,public_metrics',
      'max_results': String(batchSize),
    };
    if (nextToken) params.pagination_token = nextToken;

    const data = await twitterGet(`/users/${profile.id}/tweets`, params);
    const tweets = (data.data || []).map((t: any) => parseTweet(t));
    allTweets.push(...tweets);
    fetched += tweets.length;

    nextToken = data.meta?.next_token;
    if (!nextToken || tweets.length === 0) break;
  }

  const total = allTweets.length;
  if (total === 0) {
    return {
      profile,
      totalTweets: 0,
      avgImpressions: 0,
      avgLikes: 0,
      avgReplies: 0,
      avgRetweets: 0,
      topByImpressions: [],
      topByLikes: [],
      topByReplies: [],
      recentTweets: [],
    };
  }

  const sum = allTweets.reduce((acc, t) => ({
    impressions: acc.impressions + t.publicMetrics.impressionCount,
    likes: acc.likes + t.publicMetrics.likeCount,
    replies: acc.replies + t.publicMetrics.replyCount,
    retweets: acc.retweets + t.publicMetrics.retweetCount,
  }), { impressions: 0, likes: 0, replies: 0, retweets: 0 });

  const sortBy = (arr: TweetMetrics[], key: keyof TweetMetrics['publicMetrics']) =>
    [...arr].sort((a, b) => b.publicMetrics[key] - a.publicMetrics[key]).slice(0, 5);

  return {
    profile,
    totalTweets: total,
    avgImpressions: Math.round(sum.impressions / total),
    avgLikes: Math.round((sum.likes / total) * 100) / 100,
    avgReplies: Math.round((sum.replies / total) * 100) / 100,
    avgRetweets: Math.round((sum.retweets / total) * 100) / 100,
    topByImpressions: sortBy(allTweets, 'impressionCount'),
    topByLikes: sortBy(allTweets, 'likeCount'),
    topByReplies: sortBy(allTweets, 'replyCount'),
    recentTweets: allTweets.slice(0, 10),
  };
}
