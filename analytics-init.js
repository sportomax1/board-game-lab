/**
 * Vercel Web Analytics Initialization
 * 
 * This module initializes Vercel Web Analytics for the application.
 * It uses the inject() function from @vercel/analytics to set up analytics tracking.
 * 
 * To use this in your HTML files, add the following as a module script:
 * <script type="module" src="analytics-init.js"></script>
 * 
 * Or use the CDN-based approach with the script tag documented at:
 * https://vercel.com/docs/analytics/package
 */

// Vercel Web Analytics - Initialize analytics on client side
// This module should be imported as: <script type="module" src="analytics-init.js"></script>
// Or directly in a module context

// Import inject function from @vercel/analytics
// Try dynamic import so page doesn't fail when the package isn't available in the browser
(async function initVercelAnalytics(){
	try {
		const mod = await import('@vercel/analytics');
		if (mod && typeof mod.inject === 'function') {
			mod.inject();
			console.log('Vercel Web Analytics initialized successfully');
		}
	} catch (err) {
		// Graceful fallback for local/dev environments where the package isn't resolvable in-browser
		console.warn('Vercel analytics not available in this environment:', err && err.message ? err.message : err);
	}
})();
