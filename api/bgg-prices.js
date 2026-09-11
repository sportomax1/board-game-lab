// Server-side BGG/Geekdo marketplace aggregator for bgg-price-tracker.html.
const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = global.__bggPriceCache || (global.__bggPriceCache = new Map());

const endpoints = (id) => ({
  amazon: `https://api.geekdo.com/api/amazon/textads?locale=us&objectid=${encodeURIComponent(id)}&objecttype=thing`,
  vendors: `https://api.geekdo.com/api/affiliateads?context=gamemarketplace&objectid=${encodeURIComponent(id)}&objecttype=thing&previewid=0`,
  ebay: `https://api.geekdo.com/api/geekbay/items?ajax=1&objectid=${encodeURIComponent(id)}&objecttype=thing&pageid=1&showcount=25&sort=price`,
  geekmarket: `https://api.geekdo.com/api/market/products?ajax=1&nosession=1&objectid=${encodeURIComponent(id)}&objecttype=thing&pageid=1&showcount=50&stock=instock`
});

const number = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value) => Math.round(value * 100) / 100;

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      referer: 'https://boardgamegeek.com/',
      'user-agent': 'Sportomax-BGG-Price-Tracker/1.0'
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function summarize(rows, options) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    _price: number(options.price(row)),
    _currency: String(options.currency(row) || '').toUpperCase()
  }));
  const usd = normalizedRows
    .filter((row) => row._currency === 'USD' && row._price !== null)
    .sort((a, b) => a._price - b._price);
  const cheapest = usd[0] || null;
  const prices = usd.map((row) => row._price);

  return {
    count: normalizedRows.length,
    comparableCount: usd.length,
    min: cheapest ? cheapest._price : null,
    avg: prices.length ? round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
    max: prices.length ? prices[prices.length - 1] : null,
    currency: 'USD',
    cheapestName: cheapest ? options.name(cheapest) || '' : '',
    cheapestTitle: cheapest ? options.title(cheapest) || '' : '',
    cheapestSeller: cheapest ? options.seller(cheapest) || '' : '',
    cheapestCondition: cheapest ? options.condition(cheapest) || '' : '',
    cheapestFeedbackPercent: cheapest ? number(options.feedback(cheapest)) : null,
    cheapestUrl: cheapest ? options.url(cheapest) || '' : '',
    rows: normalizedRows.map(({ _price, _currency, ...row }) => row)
  };
}

async function lookup(id, requestedSources) {
  const urls = endpoints(id);
  const names = requestedSources;
  const settled = await Promise.allSettled(names.map((name) => getJson(urls[name])));
  const raw = {};
  const errors = {};

  settled.forEach((result, index) => {
    const name = names[index];
    if (result.status === 'fulfilled') raw[name] = result.value;
    else errors[name] = result.reason?.message || 'Request failed';
  });

  const ad = raw.amazon?.us || null;
  const amazonPrice = number(ad?.newPriceWithoutSymbol);
  const listPrice = number(ad?.listPriceWithoutSymbol);
  const amazon = ad ? {
    price: amazonPrice,
    currency: String(ad.newPriceCurrency || 'USD').toUpperCase(),
    url: ad.url || ad.sponsorurl || '',
    listPrice,
    discountPercent: amazonPrice !== null && listPrice
      ? round((1 - amazonPrice / listPrice) * 100)
      : null
  } : null;

  const empty = () => '';
  const vendors = names.includes('vendors') ? summarize(raw.vendors?.affiliate_ads, {
    price: (row) => row.price,
    currency: (row) => row.currency,
    name: (row) => row.advertiser?.name,
    title: empty,
    seller: empty,
    condition: empty,
    feedback: empty,
    url: (row) => row.url || row.redirect_url
  }) : null;
  const ebay = names.includes('ebay') ? summarize(raw.ebay?.items, {
    price: (row) => row.currentprice,
    currency: (row) => row.currency,
    name: empty,
    title: (row) => row.title,
    seller: empty,
    condition: empty,
    feedback: empty,
    url: (row) => row.url
  }) : null;
  const geekmarket = names.includes('geekmarket') ? summarize(raw.geekmarket?.products, {
    price: (row) => row.price,
    currency: (row) => row.currency,
    name: empty,
    title: empty,
    seller: (row) => row.linkeduser?.username,
    condition: (row) => row.prettycondition || row.condition,
    feedback: (row) => row.linkeduserGeekMarket?.feedback?.percentPositive,
    url: (row) => row.producthref
      ? `https://boardgamegeek.com${row.producthref}`
      : ''
  }) : null;

  const candidates = [
    names.includes('amazon') && amazon?.price !== null && amazon?.currency === 'USD'
      ? { source: 'amazon', price: amazon.price, currency: 'USD', label: 'Amazon', url: amazon.url }
      : null,
    vendors && vendors.min !== null
      ? { source: 'vendors', price: vendors.min, currency: 'USD', label: vendors.cheapestName, url: vendors.cheapestUrl }
      : null,
    ebay && ebay.min !== null
      ? { source: 'ebay', price: ebay.min, currency: 'USD', label: ebay.cheapestTitle, url: ebay.cheapestUrl }
      : null,
    geekmarket && geekmarket.min !== null
      ? { source: 'geekmarket', price: geekmarket.min, currency: 'USD', label: geekmarket.cheapestSeller, url: geekmarket.cheapestUrl }
      : null
  ].filter(Boolean);

  const result = {
    bggId: id,
    requestedSources: names,
    bestOverall: candidates.sort((a, b) => a.price - b.price)[0] || null,
    checkedAt: new Date().toISOString(),
    errors,
    raw,
    urls: Object.fromEntries(names.map((name) => [name, urls[name]]))
  };
  if (names.includes('amazon')) result.amazon = amazon;
  if (names.includes('vendors')) result.vendors = vendors;
  if (names.includes('ebay')) result.ebay = ebay;
  if (names.includes('geekmarket')) result.geekmarket = geekmarket;
  return result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = String(req.query.objectid || req.query.id || '').trim();
  const force = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
  const includeRaw = ['1', 'true', 'yes'].includes(String(req.query.raw || '').toLowerCase());
  const aliases = { others: 'vendors', marketplace: 'geekmarket' };
  const allowedSources = ['amazon', 'vendors', 'ebay', 'geekmarket'];
  const requestedSources = [...new Set(String(req.query.sources || allowedSources.join(','))
    .split(',')
    .map((source) => aliases[source.trim().toLowerCase()] || source.trim().toLowerCase())
    .filter((source) => allowedSources.includes(source)))].sort();
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'A numeric BGG ID is required' });
  if (!requestedSources.length) return res.status(400).json({ error: 'Select at least one price source' });

  try {
    const cacheKey = `${id}:${requestedSources.join(',')}`;
    const cached = cache.get(cacheKey);
    let result;
    if (!force && cached && Date.now() - cached.savedAt < CACHE_TTL) {
      result = cached.value;
      res.setHeader('X-BGG-Price-Cache', 'HIT');
    } else {
      result = await lookup(id, requestedSources);
      cache.set(cacheKey, { savedAt: Date.now(), value: result });
      res.setHeader('X-BGG-Price-Cache', 'MISS');
    }
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');
    if (includeRaw) return res.status(200).json(result);
    const { raw, ...clean } = result;
    return res.status(200).json(clean);
  } catch (error) {
    return res.status(502).json({
      error: error.message || 'Price lookup failed',
      bggId: id
    });
  }
};
