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
  const apiKey = runtime?.env?.PUBLIC_LASTFM_API_KEY || import.meta.env.PUBLIC_LASTFM_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Last.fm API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const lastFmResponse = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=1`
    );

    const data = await lastFmResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Last.fm data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
