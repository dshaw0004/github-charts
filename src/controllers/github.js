import { Octokit } from '@octokit/rest';

export const getLanguageUsage = async (env) => {
	const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
	const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
		per_page: 100,
		affiliation: 'owner',
	});

	const languageTotals = {};

	for (const repo of repos) {
		if (repo.fork || repo.archived) continue;

		const { data: languages } = await octokit.rest.repos.listLanguages({
			owner: repo.owner.login,
			repo: repo.name,
		});

		for (const [lang, bytes] of Object.entries(languages)) {
			languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
		}
	}

	return languageTotals;
};

export const getLanguageChartData = async (env) => {
	const languageTotals = await getLanguageUsage(env);

	const sorted = Object.entries(languageTotals)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	const totalBytes = sorted.reduce((sum, [, bytes]) => sum + bytes, 0);

	const chartData = sorted.map(([lang, bytes]) => ({
		lang,
		percent: +((bytes / totalBytes) * 100).toFixed(2),
	}));

	return chartData;
};

export const getLanguageChart = async (request, env) => {
	try {
		const chartData = await getLanguageChartData(env);
		if (!chartData || chartData.length === 0) {
			return new Response(JSON.stringify({ error: 'No language data available' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Limit to 10 languages max
		const topLanguages = chartData.slice(0, 10);
		const topLang = topLanguages[0];

		// Color palette for languages
		const colors = ['#3572A5', '#e34c26', '#fedf5b', '#3178c6', '#f1e05a', '#ff5a03', '#563d7c', '#4F5D95', '#00ADD8', '#701516'];

		// SVG dimensions
		const width = 620;
		const height = 260;

		// Bar width configuration
		const barWidth = 520;
		const barHeight = 10;

		// Build progress bar segments with rounded mask
		let xOffset = 0;
		const barRects = topLanguages
			.map((lang, i) => {
				const segmentWidth = (lang.percent / 100) * barWidth;
				const rect = `<rect mask="url(#rect-mask)" x="${xOffset}" y="0" width="${segmentWidth}" height="${barHeight}" fill="${colors[i % colors.length]}" />`;
				xOffset += segmentWidth;
				return rect;
			})
			.join('\n');

		// Build the 3-column grid for lower languages
		const cols = 3;
		const spacingX = 190;
		const spacingY = 28;
		const startX = 30;
		const startY = 70;

		const langCircles = topLanguages
			.slice(1)
			.map((lang, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				const x = startX + col * spacingX;
				const y = startY + row * spacingY;
				const color = colors[(i + 1) % colors.length];
				return `
        <g transform="translate(${x}, ${y})">
          <circle cx="5" cy="6" r="5" fill="${color}" />
          <text x="15" y="10" class="lang-name">${lang.lang} ${lang.percent}%</text>
        </g>`;
			})
			.join('\n');

		// --- Build the SVG ---
		const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <style>
    .header {
      font: 600 20px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #e7f216;
    }
    .lang-name {
      font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #ffffff;
    }
    .top-lang {
      font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #ffffff;
    }
    .credit {
      font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #c7c7c7;
    }
  </style>

  <!-- Background -->
  <rect x="0" y="0" width="100%" height="100%" fill="#000000" rx="6"/>

  <!-- Title + Top Language -->
  <text x="30" y="35" class="header">Most Used Languages</text>
  <text x="310" y="35" class="top-lang">👑 ${topLang.lang} ${topLang.percent}%</text>

  <!-- Mask definition for rounded progress bar -->
  <mask id="rect-mask">
    <rect x="0" y="0" width="${barWidth}" height="${barHeight}" fill="white" rx="5" ry="5"/>
  </mask>

  <!-- Language Progress Bar -->
  <g transform="translate(30, 70)">
    ${barRects}
  </g>

  <!-- Language list below -->
  <g transform="translate(0, 50)">
    ${langCircles}
  </g>
<text xmlns="http://www.w3.org/2000/svg" x="420" y="230" class="credit">created by @dshaw0004</text>
</svg>`;

		return new Response(svg, {
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=86400', // Cache for 1 day in browser/CDN
			},
		});
	} catch (error) {
		console.error('Error generating language chart:', error);
		return new Response(JSON.stringify({ error: 'Failed to generate chart' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
