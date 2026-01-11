/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const { pathname, method } = url;
		console.log('Request for', pathname);
		console.log('Method', method);
		if (pathname === '/api/health' && method === 'GET') {
			return new Response(JSON.stringify({ status: 'ok' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		} else if (pathname === '/api/echo' && method === 'POST') {
			const body = await request.text();
			return new Response(`Echo: ${body}`, {
				headers: { 'Content-Type': 'text/plain' },
			});
		} else if (pathname === '/' && method === 'GET') {
			return new Response('Hello World!');
		} else if (pathname === '/api/language-chart') {
			const cache = caches.default;
			const cacheKey = new Request(request.url);
			let response = await cache.match(cacheKey);
			if (response) {
				return response;
			}
			const { getLanguageChart } = await import('./controllers/github.js');
			response = await getLanguageChart(request, env);
			await cache.put(cacheKey, response.clone());
			return response;
		} else {
			return new Response('Not Found', { status: 404 });
		}
	},
};
