const STEAM_STORE_BASE_URL = 'https://store.steampowered.com'
const STEAM_API_BASE_URL = 'https://api.steampowered.com'
const GAME_POOL_TARGET = 48
const GAME_POOL_SAMPLE_SIZE = 220
const MIN_APPID = 10
const REVIEW_FETCH_CONCURRENCY = 4
const MIN_TOTAL_REVIEWS = 5000

function buildAppListUrl() {
  const url = new URL('/ISteamApps/GetAppList/v2/', STEAM_API_BASE_URL)
  return url
}

function buildReviewsUrl(appid) {
  const url = new URL(`/appreviews/${appid}`, STEAM_STORE_BASE_URL)
  url.searchParams.set('json', '1')
  url.searchParams.set('language', 'all')
  url.searchParams.set('purchase_type', 'all')
  url.searchParams.set('review_type', 'all')
  url.searchParams.set('filter', 'all')
  url.searchParams.set('day_range', '365')
  url.searchParams.set('num_per_page', '0')
  url.searchParams.set('cursor', '*')
  return url
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Steam request failed with status ${response.status}`)
  }

  return await response.json()
}

function shuffleArray(items) {
  const clone = [...items]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
  }

  return clone
}

function collectCatalogCandidates(appListResponse) {
  const apps = appListResponse?.applist?.apps ?? []

  return apps.filter((app) => {
    const appid = Number(app?.appid ?? 0)
    const name = app?.name?.trim?.() ?? ''

    if (!appid || appid < MIN_APPID || !name) return false
    if (name.length < 2) return false
    if (/dedicated server|soundtrack|demo|test server|trailer/i.test(name)) return false

    return true
  })
}

function buildImageUrl(appid, kind) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${kind}`
}

function mapCatalogGame(item, stats) {
  const appid = String(item.appid)

  return {
    appid,
    name: item.name,
    total_reviews: stats.total_reviews,
    rating: stats.rating,
    image_url: buildImageUrl(appid, 'header.jpg'),
    library_image: buildImageUrl(appid, 'library_600x900.jpg'),
    stats_source: stats.source,
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = []
  const activeTasks = []

  for (const item of items) {
    const task = Promise.resolve().then(() => mapper(item))
    results.push(task)
    activeTasks.push(task)

    const removeTask = () => {
      const taskIndex = activeTasks.indexOf(task)
      if (taskIndex >= 0) {
        activeTasks.splice(taskIndex, 1)
      }
    }

    task.then(removeTask, removeTask)

    if (activeTasks.length >= limit) {
      await Promise.race(activeTasks)
    }
  }

  return await Promise.all(results)
}

export async function getSteamGameStats(appid) {
  const reviewsData = await fetchJson(buildReviewsUrl(appid))
  const summary = reviewsData?.query_summary

  if (!summary || typeof summary.total_reviews !== 'number') {
    throw new Error('Steam response did not include review summary data.')
  }

  const totalPositive = typeof summary.total_positive === 'number' ? summary.total_positive : 0
  const totalReviews = summary.total_reviews

  return {
    appid: String(appid),
    total_reviews: totalReviews,
    rating: totalReviews > 0 ? (totalPositive / totalReviews) * 100 : 0,
    review_score_desc: summary.review_score_desc ?? '',
    source: 'steam-store',
  }
}

export async function getSteamGames() {
  const appListResponse = await fetchJson(buildAppListUrl())
  const catalogCandidates = collectCatalogCandidates(appListResponse)
  const sampledCandidates = shuffleArray(catalogCandidates).slice(0, GAME_POOL_SAMPLE_SIZE)

  const hydratedGames = await mapWithConcurrency(
    sampledCandidates,
    REVIEW_FETCH_CONCURRENCY,
    async (item) => {
      try {
        const stats = await getSteamGameStats(item.appid)
        return mapCatalogGame(item, stats)
      } catch (error) {
        return null
      }
    },
  )

  return hydratedGames
    .filter(Boolean)
    .filter((game) => game.total_reviews >= MIN_TOTAL_REVIEWS)
    .sort((firstGame, secondGame) => secondGame.total_reviews - firstGame.total_reviews)
    .slice(0, GAME_POOL_TARGET)
}
