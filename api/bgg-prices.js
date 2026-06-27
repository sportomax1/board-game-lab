// api/bgg-prices.js - BGG/Geekdo marketplace price proxy
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const objectid = String(req.query.objectid || req.query.id || '').trim();
  const raw = String(req.query.raw || '').toLowerCase();
  if (!objectid) return res.status(400).json({ error: 'Missing objectid' });

  const urls = {
    amazon: `https://api.geekdo.com/api/amazon/textads?locale=us&objectid=${encodeURIComponent(objectid)}&objecttype=thing`,
    vendors: `https://api.geekdo.com/api/affiliateads?context=gamemarketplace&objectid=${encodeURIComponent(objectid)}&objecttype=thing&previewid=0`,
    ebay: `https://api.geekdo.com/api/geekbay/items?ajax=1&objectid=${encodeURIComponent(objectid)}&objecttype=thing&pageid=1&showcount=25&sort=price`,
    geekmarket: `https://api.geekdo.com/api/market/products?ajax=1&nosession=1&objectid=${encodeURIComponent(objectid)}&objecttype=thing&pageid=1&showcount=50&stock=instock`
  };

  async function getJson(url) {
    const r = await fetch(url, { headers: { accept: 'application/json', referer: 'https://boardgamegeek.com/' } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }
  const toNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  function summarize(rows, priceKey, currency, labelFn, urlFn) {
    const comparable = rows
      .filter(r => (r.currency || r.newPriceCurrency || currency) === currency)
      .map(r => ({ ...r, _price: toNum(r[priceKey]) }))
      .filter(r => r._price !== null);
    if (!comparable.length) return { count: rows.length, min: null, avg: null, max: null, currency, cheapestLabel: '', cheapestUrl: '', rows: raw === '1' ? rows : undefined };
    comparable.sort((a,b) => a._price - b._price);
    const prices = comparable.map(r => r._price);
    const cheapest = comparable[0];
    return {
      count: rows.length,
      min: prices[0],
      avg: Math.round((prices.reduce((a,b) => a + b, 0) / prices.length) * 100) / 100,
      max: prices[prices.length - 1],
      currency,
      cheapestLabel: labelFn ? labelFn(cheapest) : '',
      cheapestUrl: urlFn ? urlFn(cheapest) : '',
      rows: raw === '1' ? rows : undefined
    };
  }

  const names = ['amazon','vendors','ebay','geekmarket'];
  const settled = await Promise.allSettled(names.map(k => getJson(urls[k])));
  const errors = {};
  const data = {};
  settled.forEach((r, i) => {
    const k = names[i];
    if (r.status === 'fulfilled') data[k] = r.value;
    else errors[k] = r.reason.message || 'failed';
  });

  const a = data.amazon && data.amazon.us ? data.amazon.us : null;
  const amazonPrice = toNum(a && a.newPriceWithoutSymbol);
  const listPrice = toNum(a && a.listPriceWithoutSymbol);
  const amazon = a ? {
    price: amazonPrice,
    currency: a.newPriceCurrency || 'USD',
    url: a.url || a.sponsorurl || '',
    title: a.title || 'Amazon',
    listPrice,
    discountPercent: amazonPrice && listPrice ? Math.round((1 - amazonPrice / listPrice) * 1000) / 10 : null
  } : null;

  const vendorsRows = (data.vendors && data.vendors.affiliate_ads) || [];
  const ebayRows = (data.ebay && data.ebay.items) || [];
  const geekRows = (data.geekmarket && data.geekmarket.products) || [];

  const vendors = summarize(vendorsRows, 'price', 'USD', r => r.advertiser && r.advertiser.name, r => r.url);
  const ebay = summarize(ebayRows, 'currentprice', 'USD', r => r.title, r => r.url);
  const geekmarket = summarize(geekRows, 'price', 'USD', r => `${(r.linkeduser && r.linkeduser.username) || 'seller'}${r.prettycondition ? ' - ' + r.prettycondition : ''}`, r => r.producthref ? `https://boardgamegeek.com${r.producthref}` : '');

  const candidates = [];
  if (amazon && amazon.price !== null) candidates.push({ source: 'Amazon', price: amazon.price, currency: amazon.currency, label: 'Amazon', url: amazon.url });
  if (vendors.min !== null) candidates.push({ source: 'Vendors', price: vendors.min, currency: vendors.currency, label: vendors.cheapestLabel, url: vendors.cheapestUrl });
  if (ebay.min !== null) candidates.push({ source: 'eBay', price: ebay.min, currency: ebay.currency, label: ebay.cheapestLabel, url: ebay.cheapestUrl });
  if (geekmarket.min !== null) candidates.push({ source: 'GeekMarket', price: geekmarket.min, currency: geekmarket.currency, label: geekmarket.cheapestLabel, url: geekmarket.cheapestUrl });
  const bestOverall = candidates.filter(c => c.currency === 'USD').sort((a,b) => a.price - b.price)[0] || null;

  return res.status(200).json({ objectid, amazon, vendors, ebay, geekmarket, bestOverall, checkedAt: new Date().toISOString(), errors, urls });
};
