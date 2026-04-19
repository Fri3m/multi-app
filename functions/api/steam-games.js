import { getSteamGames } from '../../server/steamApi.js'

const STEAM_GAMES_CACHE_CONTROL = 'public, max-age=21600, s-maxage=21600'

function createJsonResponse(body, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', STEAM_GAMES_CACHE_CONTROL)

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export async function onRequestGet(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    return cachedResponse
  }

  let games
  try {
    games = await getSteamGames()
  } catch (error) {
    return createJsonResponse(
      {
        error: error.message,
      },
      { status: 502 },
    )
  }

  const response = createJsonResponse(games)
  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
