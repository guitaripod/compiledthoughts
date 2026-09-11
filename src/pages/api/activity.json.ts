import type { APIRoute } from 'astro';
import { buildActivitySnapshot } from '../../lib/github-activity.mjs';

export const prerender = false;

const json = (body: unknown, status: number, cacheControl: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });

export const GET: APIRoute = async (context) => {
  const runtime = (context.locals as any).runtime;
  const token = runtime?.env?.GITHUB_TOKEN || import.meta.env.GITHUB_TOKEN;
  if (!token) return json({ error: 'GitHub token not configured' }, 503, 'no-cache');

  try {
    const snapshot = await buildActivitySnapshot({ token });
    return json(snapshot, 200, 'public, max-age=300, s-maxage=300');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return json({ error: `GitHub activity unavailable: ${message}` }, 503, 'no-cache');
  }
};
