import type { APIRoute } from 'astro';

export const prerender = false;

// Your Steam ID from the URL
const STEAM_ID = '76561199127850209'; // Extracted from your profile URL

export const GET: APIRoute = async (context) => {
  // In Cloudflare Pages, secrets are available via context.locals.runtime.env
  const runtime = (context.locals as any).runtime;
  const apiKey = runtime?.env?.STEAM_API_KEY || import.meta.env.STEAM_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Steam API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch player summary
    const summaryResponse = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${STEAM_ID}`
    );
    const summaryData = await summaryResponse.json();

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

    return new Response(
      JSON.stringify({
        player,
        currentGame,
        recentGames: recentGamesData.response?.games || [],
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
