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
import { inject } from '@vercel/analytics';

// Initialize Web Analytics tracking
inject();

console.log('Vercel Web Analytics initialized successfully');
