export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const { pathname } = url;
		if (pathname === '/') {
			return new Response('Created by dshaw0004');
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
