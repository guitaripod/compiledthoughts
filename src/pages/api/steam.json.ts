import type { APIRoute } from 'astro';

export const prerender = false;

// Your Steam vanity URL
const STEAM_VANITY_URL = 'kratos42069'; // From your profile URL

export const GET: APIRoute = async (context) => {
  console.log('[Steam API] Handling request');

  // Try multiple ways to access the API key in Cloudflare Pages
  let apiKey;

  // Method 1: Direct from context.env (Cloudflare Pages Functions)
  if (context.env?.STEAM_API_KEY) {
    apiKey = context.env.STEAM_API_KEY;
    console.log('[Steam API] Found key in context.env');
  }
  // Method 2: From locals.runtime.env
  else if ((context.locals as any)?.runtime?.env?.STEAM_API_KEY) {
    apiKey = (context.locals as any).runtime.env.STEAM_API_KEY;
    console.log('[Steam API] Found key in locals.runtime.env');
  }
  // Method 3: From import.meta.env (dev environment)
  else if (import.meta.env.STEAM_API_KEY) {
    apiKey = import.meta.env.STEAM_API_KEY;
    console.log('[Steam API] Found key in import.meta.env');
  }

  console.log('[Steam API] API key configured:', !!apiKey);

  if (!apiKey) {
    console.error('[Steam API] No API key found in environment');
    return new Response(JSON.stringify({ error: 'Steam API key not configured' }), {
      status: 503, // Service Unavailable is more appropriate
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }

  try {
    // First, resolve vanity URL to Steam ID
    const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${STEAM_VANITY_URL}`;
    console.log('[Steam API] Resolving vanity URL:', STEAM_VANITY_URL);

    const resolveResponse = await fetch(resolveUrl, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!resolveResponse.ok) {
      console.error('[Steam API] Resolve request failed:', resolveResponse.status);
      throw new Error(`Steam API returned ${resolveResponse.status}`);
    }

    const resolveData = await resolveResponse.json();
    console.log('[Steam API] Resolve response:', JSON.stringify(resolveData));

    if (resolveData.response?.success !== 1) {
      console.error('[Steam API] Failed to resolve vanity URL:', resolveData);
      throw new Error('Failed to resolve Steam vanity URL');
    }

    const STEAM_ID = resolveData.response.steamid;
    console.log('[Steam API] Resolved Steam ID:', STEAM_ID);

    // Fetch player summary
    const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${STEAM_ID}`;
    console.log('[Steam API] Fetching player summary for Steam ID:', STEAM_ID);

    const summaryResponse = await fetch(summaryUrl);
    console.log('[Steam API] Summary response status:', summaryResponse.status);

    const summaryData = await summaryResponse.json();
    console.log('[Steam API] Summary data:', JSON.stringify(summaryData));

    // Fetch recently played games
    const recentGamesResponse = await fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${STEAM_ID}&count=5`
    );
    console.log('[Steam API] Recent games response status:', recentGamesResponse.status);

    const recentGamesData = await recentGamesResponse.json();
    console.log('[Steam API] Recent games data:', JSON.stringify(recentGamesData));

    // Check if currently in game
    const player = summaryData.response?.players?.[0];
    const currentGame = player?.gameid
      ? {
          id: player.gameid,
          name: player.gameextrainfo || 'In Game',
        }
      : null;

    // Get more detailed game info including achievements for recent games
    const recentGames = recentGamesData.response?.games || [];

    // For each recent game, we could fetch achievement data, but that requires many API calls
    // Steam API rate limits are generous (100k/day) but we should be conservative

    console.log('[Steam API] Player profile:', player?.personaname, 'Level:', player?.playerlevel);

    return new Response(
      JSON.stringify({
        player,
        currentGame,
        recentGames,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Steam data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
