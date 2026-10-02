// Consolidated Vercel Node router.
// Legacy public /api/* paths are rewritten here in vercel.json, while the
// actual handlers live outside /api so Vercel does not count each as a function.
//
// IMPORTANT: handlers are lazy-loaded. Eagerly requiring every handler means
// one optional handler with a missing dependency can crash ALL consolidated API
// routes before the requested route gets a chance to run.
const handlerPaths = {
  'bgg-lab': '../server/api-handlers/bgg-lab',
  'bgg-max-scan': '../server/api-handlers/bgg-max-scan',
  'bgg-prices': '../server/api-handlers/bgg-prices',
  'cardboard-proxy': '../server/api-handlers/cardboard-proxy',
  'image-proxy': '../server/api-handlers/image-proxy',
  'log-ranks': '../server/api-handlers/log-ranks',
  'firebase-config': '../server/api-handlers/firebase-config',
  'geekmail': '../server/api-handlers/geekmail',
  'get-password': '../server/api-handlers/get-password',
  'supabase-config': '../server/api-handlers/supabase-config',
};

module.exports = async (req, res) => {
  const route = String(
    req.query.route ||
    req.url?.match(/^\/api\/core\/([^?]+)/)?.[1] ||
    ''
  ).trim();

  const handlerPath = handlerPaths[route];
  if (!handlerPath) {
    return res.status(404).json({ ok: false, error: 'Unknown consolidated API route' });
  }

  let handler;
  try {
    handler = require(handlerPath);
  } catch (error) {
    console.error(`Failed to load API handler "${route}":`, error);
    return res.status(500).json({
      ok: false,
      error: `API handler failed to load: ${route}`
    });
  }

  if (typeof handler !== 'function') {
    console.error(`API handler "${route}" did not export a function`);
    return res.status(500).json({
      ok: false,
      error: `Invalid API handler: ${route}`
    });
  }

  const originalQuery = req.query;
  req.query = { ...req.query };
  delete req.query.route;

  try {
    return await handler(req, res);
  } finally {
    req.query = originalQuery;
  }
};
