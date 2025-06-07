import type { APIRoute } from 'astro';

export const prerender = false;

// Your Steam ID from the URL
const STEAM_ID = '76561199127850209'; // Extracted from your profile URL

export const GET: APIRoute = async (context) => {
  console.log('[Steam API] Handling request');

  // In Cloudflare Pages, secrets are available via context.locals.runtime.env
  const runtime = (context.locals as any).runtime;
  const apiKey = runtime?.env?.STEAM_API_KEY || import.meta.env.STEAM_API_KEY;

  console.log('[Steam API] API key configured:', !!apiKey);

  if (!apiKey) {
    console.error('[Steam API] No API key found in environment');
    return new Response(JSON.stringify({ error: 'Steam API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch player summary
    const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${STEAM_ID}`;
    console.log('[Steam API] Fetching player summary for Steam ID:', STEAM_ID);

    const summaryResponse = await fetch(summaryUrl);
    console.log('[Steam API] Summary response status:', summaryResponse.status);

    const summaryData = await summaryResponse.json();
    console.log('[Steam API] Summary data:', JSON.stringify(summaryData));

    // Fetch recently played games
    const recentGamesResponse = await fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${STEAM_ID}&count=3`
    );
    const recentGamesData = await recentGamesResponse.json();

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
