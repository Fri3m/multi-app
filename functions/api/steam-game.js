import { getSteamGameStats } from '../../server/steamApi.js'

const STEAM_GAME_CACHE_CONTROL = 'public, max-age=21600, s-maxage=21600'

function createJsonResponse(body, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', STEAM_GAME_CACHE_CONTROL)

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const appid = url.searchParams.get('appid')?.trim()

  if (!appid || !/^\d+$/.test(appid)) {
    return createJsonResponse(
      {
        error: 'A numeric appid query parameter is required.',
      },
      { status: 400 },
    )
  }

  const cache = caches.default
  const cacheKey = new Request(url.toString(), context.request)
  const cachedResponse = await cache.match(cacheKey)
  if (cachedResponse) {
    return cachedResponse
  }

  let stats
  try {
    stats = await getSteamGameStats(appid)
  } catch (error) {
    return createJsonResponse(
      {
        error: error.message,
      },
      { status: 502 },
    )
  }

  const response = createJsonResponse(stats)
  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
