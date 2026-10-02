// Consolidated Vercel Node router.
// Legacy public /api/* paths are rewritten here in vercel.json, while the
// actual handlers live outside /api so Vercel does not count each as a function.
const handlers = {
  'bgg-lab': require('../server/api-handlers/bgg-lab'),
  'bgg-max-scan': require('../server/api-handlers/bgg-max-scan'),
  'bgg-prices': require('../server/api-handlers/bgg-prices'),
  'cardboard-proxy': require('../server/api-handlers/cardboard-proxy'),
  'image-proxy': require('../server/api-handlers/image-proxy'),
  'log-ranks': require('../server/api-handlers/log-ranks'),
};
module.exports = async (req,res) => {
  const route = String(req.query.route || '').trim();
  const handler = handlers[route];
  if (!handler) return res.status(404).json({ok:false,error:'Unknown consolidated API route'});
  const originalQuery = req.query;
  req.query = {...req.query};
  delete req.query.route;
  try { return await handler(req,res); }
  finally { req.query = originalQuery; }
};