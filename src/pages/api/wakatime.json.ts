import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return new Response(JSON.stringify({ error: 'Username required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // In Cloudflare Pages, secrets are available via context.locals.runtime.env
  const runtime = (context.locals as any).runtime;
  const apiKey = runtime?.env?.WAKATIME_API_KEY || import.meta.env.WAKATIME_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'WakaTime API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch stats for the last 7 days
    const statsResponse = await fetch(
      `https://wakatime.com/api/v1/users/${username}/stats/last_7_days`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
        },
      }
    );

    if (!statsResponse.ok) {
      throw new Error(`WakaTime API error: ${statsResponse.status}`);
    }

    const data = await statsResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch WakaTime data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
