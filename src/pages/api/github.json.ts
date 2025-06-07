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

  // Optional: Use GitHub token for higher rate limits
  const runtime = (context.locals as any).runtime;
  const githubToken = runtime?.env?.GITHUB_TOKEN || import.meta.env.GITHUB_TOKEN;

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'compiledthoughts-website',
  };

  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
    console.log('[GitHub API] Using authenticated requests');
  } else {
    console.log('[GitHub API] Using unauthenticated requests (rate limited to 60/hour)');
  }

  try {
    // Fetch user data
    const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });

    if (!userResponse.ok) {
      const rateLimitRemaining = userResponse.headers.get('X-RateLimit-Remaining');
      console.error(
        '[GitHub API] User fetch failed. Status:',
        userResponse.status,
        'Rate limit remaining:',
        rateLimitRemaining
      );
      throw new Error(`GitHub API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();

    // Fetch recent repos
    const reposResponse = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=3`,
      { headers }
    );

    const recentRepos = reposResponse.ok ? await reposResponse.json() : [];

    return new Response(JSON.stringify({ user: userData, repos: recentRepos }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('[GitHub API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch GitHub data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
