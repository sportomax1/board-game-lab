'use strict';

// Read-only adapter for BGG's unofficial game photo gallery.
// No BGG bearer token or user cookies are forwarded to this endpoint.
module.exports = async function bggGallery(req, res) {
  res.setHeader('Allow', 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Only GET requests are supported.' });
  }

  const gameId = String(req.query.gameId || '').trim();
  const page = Number(req.query.page || 1);
  const count = Number(req.query.count || 50);
  if (!/^[1-9]\d{0,8}$/.test(gameId) ||
      !Number.isSafeInteger(page) || page < 1 || page > 1000 ||
      !Number.isSafeInteger(count) || count < 1 || count > 50) {
    return res.status(400).json({ error: 'Use a numeric gameId, page 1-1000 and count 1-50.' });
  }

  const url = new URL('https://api.geekdo.com/api/images');
  for (const [key, value] of Object.entries({
    ajax: '1', gallery: 'all', nosession: '1',
    objectid: gameId, objecttype: 'thing', pageid: String(page),
    showcount: String(count), size: 'thumb', sort: 'recent'
  })) url.searchParams.set(key, value);

  try {
    const upstream = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BoardGameLab-Jackets/1.0',
        'Referer': 'https://boardgamegeek.com/'
      },
      redirect: 'error',
      signal: AbortSignal.timeout(16000)
    });
    if (!upstream.ok) {
      return res.status([403, 404, 429].includes(upstream.status) ? upstream.status : 502).json({
        error: 'BGG gallery request failed.', upstreamStatus: upstream.status
      });
    }
    const data = await upstream.json();
    if (!data || !Array.isArray(data.images)) {
      return res.status(502).json({ error: 'Unexpected BGG gallery response.' });
    }
    const validImage = urlString => {
      try {
        const parsed = new URL(urlString);
        return parsed.protocol === 'https:' && (parsed.hostname === 'cf.geekdo-images.com' || parsed.hostname.endsWith('.geekdo-images.com'));
      } catch { return false; }
    };
    const images = data.images.slice(0, count).map(item => {
      const id = String(item.imageid || '');
      const large = validImage(item.imageurl_lg) ? item.imageurl_lg : '';
      const thumb = validImage(item['imageurl@2x']) ? item['imageurl@2x'] :
        validImage(item.imageurl) ? item.imageurl : large;
      return {
        imageid: id,
        caption: String(item.caption || '').slice(0, 300),
        imageurl_lg: large || thumb,
        imageurl: thumb || large,
        href: /^\/image\/\d+\//.test(String(item.href || '')) ? item.href : '/image/' + id,
        user: { username: String(item.user?.username || '').slice(0, 80) }
      };
    }).filter(item => /^\d+$/.test(item.imageid) && item.imageurl_lg);

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      gameId, page, count, images,
      hasMore: data.images.length >= count
    });
  } catch (error) {
    console.error('BGG gallery proxy error:', error.message);
    return res.status(502).json({
      error: 'Could not retrieve BGG images. Try again, or use the BGG gallery link.'
    });
  }
};
