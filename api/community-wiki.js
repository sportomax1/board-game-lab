'use strict';

/**
 * Public Community Wiki page fetcher for Board Game Lab.
 *
 * BGG's registered XML API token ONLY applies to XML API endpoints. Never send
 * it (or cookies, secrets, or private headers) to Community Wiki HTML pages.
 *
 * This makes exactly one ordinary public GET per on-demand request. If BGG
 * returns 403 or otherwise restricts access, honor the response rather than
 * trying alternate hosts, cookies, challenges, or headless-browser tricks.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'GET, HEAD');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!/^[1-9][0-9]{0,8}$/.test(id)) {
    return res.status(400).json({ error: 'Provide a valid numeric BGG game ID.' });
  }

  const url = 'https://boardgamegeek.com/wiki/page/' +
    encodeURIComponent('thing:' + id + ':moreinfo');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BoardGameLabCommunityWiki/1.0',
        'Accept': 'text/html,application/xhtml+xml;q=0.9',
      },
    });
    if (upstream.status === 403 || upstream.status === 401) {
      return res.status(403).json({
        code: 'BGG_WIKI_RESTRICTED',
        message: 'BGG declined automated access to this Community Wiki page. Its XML API token does not authorize wiki HTML. Automatic live wiki retrieval is unavailable.',
      });
    }
    if (upstream.status === 404) {
      return res.status(404).json({
        code: 'WIKI_NOT_FOUND',
        message: 'BGG does not have a public Community Wiki page for this game.',
      });
    }
    if (upstream.status === 429) {
      return res.status(429).json({
        code: 'BGG_RATE_LIMIT',
        message: 'BGG is rate limiting requests. Please try again later.',
      });
    }
    if (!upstream.ok) {
      return res.status(502).json({
        code: 'BGG_WIKI_UNAVAILABLE',
        message: 'BGG Community Wiki could not be retrieved (HTTP ' + upstream.status + ').',
      });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return res.status(502).json({
        code: 'UNEXPECTED_CONTENT',
        message: 'BGG did not return a readable HTML wiki page.',
      });
    }
    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > 1500000) {
      return res.status(502).json({
        code: 'WIKI_TOO_LARGE',
        message: 'BGG wiki response exceeded the supported size.',
      });
    }
    const html = await upstream.text();
    if (html.length > 1500000) {
      return res.status(502).json({ code: 'WIKI_TOO_LARGE', message: 'BGG wiki response was too large.' });
    }
    if (/cf-mitigated|Just a moment|Enable JavaScript and cookies to continue/i.test(html) && !html.includes('moreinfo')) {
      return res.status(403).json({
        code: 'BGG_WIKI_RESTRICTED',
        message: 'BGG presented a browser challenge rather than the Community Wiki. The app will not bypass it.',
      });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      id,
      source: 'BGG Community Wiki public HTML',
      html,
    });
  } catch (err) {
    return res.status(err?.name === 'AbortError' ? 504 : 502).json({
      code: 'BGG_WIKI_REQUEST_FAILED',
      message: err?.name === 'AbortError'
        ? 'BGG did not respond within 14 seconds.'
        : 'Unable to access BGG public Community Wiki at this time.',
    });
  } finally {
    clearTimeout(timeout);
  }
};