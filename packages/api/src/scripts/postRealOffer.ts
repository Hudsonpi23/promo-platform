import 'dotenv/config';
import axios from 'axios';

const offer = {
  title: 'CÃ¢mera De SeguranÃ§a LÃ¢mpada Soquete Wifi VisÃ£o Noturna 360Â° Full HD',
  originalPrice: 78.95,
  finalPrice: 49.60,
  discount: 37,
  affiliateUrl: 'https://www.mercadolivre.com.br/social/dh20260120130733?matt_word=dh20260120130733&matt_tool=77551400&forceInApp=true&ref=BGa%2FimCrFn7%2FVpQQbvDIxKnvczm319Vel5sgXmVP%2Bmn2oTKpwfI1VG9zo%2BUv09YOHlkix%2BW06FJtnYfA0WdRspN%2FrZ1vak2Ol962JMevn1NG%2B4FeHN%2F75sHUVkDPpIGkk2nh7MDSVRun0xWRtEQwqrMwzbcRB0scPmU56n1l2rgqcxmSSzTexCWSCQfMKr0bwSK3bg%3D%3D',
  imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_859149-MLU75480835392_042024-F.webp',
  storeName: 'Mercado Livre',
};

function generateFacebookText(): string {
  return `ðŸ”¥ OFERTA IMPERDÃVEL! ðŸ”¥

ðŸ“· ${offer.title}

ðŸ’° De R$ ${offer.originalPrice.toFixed(2).replace('.', ',')}
ðŸ·ï¸ Por apenas R$ ${offer.finalPrice.toFixed(2).replace('.', ',')}
ðŸ“‰ ${offer.discount}% OFF!

ðŸ›’ ${offer.storeName}

âœ… Wi-Fi 360Â°
âœ… VisÃ£o Noturna
âœ… Full HD
âœ… App Yoosee

ðŸ‘‰ Compre aqui: ${offer.affiliateUrl}

#promocao #oferta #desconto #camera #seguranca #wifi #mercadolivre`;
}

function generateTweetText(): string {
  return `ðŸ“· ${offer.title}

De R$ ${offer.originalPrice.toFixed(2).replace('.', ',')} por R$ ${offer.finalPrice.toFixed(2).replace('.', ',')} (-${offer.discount}%)

ðŸ›’ ${offer.storeName}
ðŸ‘‰ ${offer.affiliateUrl}`;
}

async function postToFacebook(pageId: string, pageToken: string, pageName: string): Promise<boolean> {
  try {
    const graphVersion = process.env.META_GRAPH_VERSION || 'v24.0';
    const text = generateFacebookText();
    
    console.log(`\nðŸ“˜ Postando no Facebook: ${pageName}...`);
    
    const response = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${pageId}/photos`,
      {
        url: offer.imageUrl,
        caption: text,
        access_token: pageToken,
      }
    );
    
    console.log(`   âœ… Sucesso! Post ID: ${response.data.id || response.data.post_id}`);
    return true;
  } catch (error: any) {
    console.log(`   âŒ Erro: ${error.response?.data?.error?.message || error.message}`);
    return false;
  }
}

async function postToTwitter(): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    
    const apiKey = process.env.TWITTER_API_KEY!;
    const apiSecret = process.env.TWITTER_API_SECRET!;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
    
    console.log(`\nðŸ¦ Postando no Twitter/X...`);
    
    const imageResponse = await axios.get(offer.imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
    
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
      const sortedParams = Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
      const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
      const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
      return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
    }

    function generateOAuthHeader(method: string, url: string, additionalParams: Record<string, string> = {}): string {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: accessToken,
        oauth_version: '1.0',
      };
      const allParams = { ...oauthParams, ...additionalParams };
      const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessTokenSecret);
      oauthParams.oauth_signature = signature;
      const headerString = Object.keys(oauthParams).sort().map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`).join(', ');
      return `OAuth ${headerString}`;
    }
    
    const uploadParams: Record<string, string> = { media_data: imageBase64 };
    const uploadHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
    const uploadResponse = await axios.post(uploadUrl, `media_data=${encodeURIComponent(imageBase64)}`, {
      headers: { Authorization: uploadHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    const mediaId = uploadResponse.data.media_id_string;
    console.log(`   ðŸ“· Imagem enviada: ${mediaId}`);
    
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetText = generateTweetText();
    const tweetBody = { text: tweetText, media: { media_ids: [mediaId] } };
    
    const tweetHeader = generateOAuthHeader('POST', tweetUrl);
    const tweetResponse = await axios.post(tweetUrl, tweetBody, {
      headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
    });
    
    const tweetId = tweetResponse.data.data.id;
    console.log(`   âœ… Sucesso! Tweet: https://twitter.com/i/web/status/${tweetId}`);
    return true;
  } catch (error: any) {
    console.log(`   âŒ Erro: ${error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message}`);
    return false;
  }
}

async function main() {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('   ðŸš€ POST COM LINK REAL - Promo Platform');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  console.log('\nðŸ“¦ Oferta:');
  console.log(`   ${offer.title}`);
  console.log(`   R$ ${offer.finalPrice.toFixed(2)} (-${offer.discount}%)`);
  console.log(`   ðŸ”— ${offer.affiliateUrl.substring(0, 60)}...`);
  
  const results = { facebook1: false, facebook2: false, twitter: false };
  
  const page1Id = process.env.META_PAGE_1_ID;
  const page1Token = process.env.META_PAGE_1_TOKEN;
  if (page1Id && page1Token) {
    results.facebook1 = await postToFacebook(page1Id, page1Token, 'Manu das PromoÃ§Ãµes');
  }
  
  const page2Id = process.env.META_PAGE_2_ID;
  const page2Token = process.env.META_PAGE_2_TOKEN;
  if (page2Id && page2Token) {
    results.facebook2 = await postToFacebook(page2Id, page2Token, 'Manu PromoÃ§Ãµes de Tecnologia');
  }
  
  if (process.env.TWITTER_API_KEY) {
    results.twitter = await postToTwitter();
  }
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('   ðŸ“Š RESUMO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(`   ðŸ“˜ Facebook (Manu das PromoÃ§Ãµes):      ${results.facebook1 ? 'âœ… OK' : 'âŒ FALHOU'}`);
  console.log(`   ðŸ“˜ Facebook (Manu PromoÃ§Ãµes Tech):     ${results.facebook2 ? 'âœ… OK' : 'âŒ FALHOU'}`);
  console.log(`   ðŸ¦ Twitter/X:                          ${results.twitter ? 'âœ… OK' : 'âŒ FALHOU'}`);
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
}

main();
