// Base API service for the multi-app platform

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const TMDB_MOVIE_CACHE_DURATION_MS = 12 * 60 * 60 * 1000
const STEAM_GAMES_CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const STEAM_GAME_STATS_CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const VIDEO_STORAGE_KEY = 'videos'
const VIDEO_OPENED_KEY = 'isOpenedBefore'

function getTmdbMovieCacheKey(mode) {
  return `tmdb-movies-cache-${mode}`
}

function getSteamGamesCacheKey() {
  return 'steam-games-cache-v3'
}

function getSteamGameStatsCacheKey(appid) {
  return `steam-game-stats-${appid}`
}

function getTmdbAuthHeaders() {
  const token = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN?.trim()
  const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim()

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  if (apiKey) {
    return {
      'Content-Type': 'application/json',
    }
  }

  throw new Error(
    'TMDb key missing. Set VITE_TMDB_READ_ACCESS_TOKEN or VITE_TMDB_API_KEY in your .env file.',
  )
}

function buildTmdbUrl(path, query = {}) {
  const url = new URL(`${TMDB_API_BASE_URL}${path}`)
  const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim()

  if (apiKey) {
    url.searchParams.set('api_key', apiKey)
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

function readCachedMovies(mode) {
  try {
    const rawCache = localStorage.getItem(getTmdbMovieCacheKey(mode))
    if (!rawCache) return null

    const cache = JSON.parse(rawCache)
    const isExpired = Date.now() - cache.savedAt > TMDB_MOVIE_CACHE_DURATION_MS

    if (isExpired || !Array.isArray(cache.movies) || cache.movies.length === 0) {
      localStorage.removeItem(getTmdbMovieCacheKey(mode))
      return null
    }

    return cache.movies
  } catch (error) {
    console.error('Error reading TMDb movie cache:', error)
    localStorage.removeItem(getTmdbMovieCacheKey(mode))
    return null
  }
}

function saveCachedMovies(mode, movies) {
  try {
    localStorage.setItem(
      getTmdbMovieCacheKey(mode),
      JSON.stringify({
        savedAt: Date.now(),
        movies,
      }),
    )
  } catch (error) {
    console.error('Error saving TMDb movie cache:', error)
  }
}

function readCachedSteamGames() {
  try {
    const rawCache = localStorage.getItem(getSteamGamesCacheKey())
    if (!rawCache) return null

    const cache = JSON.parse(rawCache)
    const isExpired = Date.now() - cache.savedAt > STEAM_GAMES_CACHE_DURATION_MS

    if (isExpired || !Array.isArray(cache.games) || cache.games.length === 0) {
      localStorage.removeItem(getSteamGamesCacheKey())
      return null
    }

    return cache.games
  } catch (error) {
    console.error('Error reading Steam games cache:', error)
    localStorage.removeItem(getSteamGamesCacheKey())
    return null
  }
}

function saveCachedSteamGames(games) {
  try {
    localStorage.setItem(
      getSteamGamesCacheKey(),
      JSON.stringify({
        savedAt: Date.now(),
        games,
      }),
    )
  } catch (error) {
    console.error('Error saving Steam games cache:', error)
  }
}

function readCachedSteamGameStats(appid) {
  try {
    const rawCache = localStorage.getItem(getSteamGameStatsCacheKey(appid))
    if (!rawCache) return null

    const cache = JSON.parse(rawCache)
    const isExpired = Date.now() - cache.savedAt > STEAM_GAME_STATS_CACHE_DURATION_MS

    if (
      isExpired ||
      typeof cache.total_reviews !== 'number' ||
      typeof cache.rating !== 'number'
    ) {
      localStorage.removeItem(getSteamGameStatsCacheKey(appid))
      return null
    }

    return cache
  } catch (error) {
    console.error('Error reading Steam game stats cache:', error)
    localStorage.removeItem(getSteamGameStatsCacheKey(appid))
    return null
  }
}

function saveCachedSteamGameStats(appid, stats) {
  try {
    localStorage.setItem(
      getSteamGameStatsCacheKey(appid),
      JSON.stringify({
        savedAt: Date.now(),
        ...stats,
      }),
    )
  } catch (error) {
    console.error('Error saving Steam game stats cache:', error)
  }
}

function getTmdbDiscoveryConfig(mode) {
  if (mode === 'classic') {
    return {
      page: Math.floor(Math.random() * 12) + 1,
      pageWindow: 4,
      query: {
        include_adult: 'false',
        include_video: 'false',
        language: 'en-US',
        sort_by: 'vote_average.desc',
        'primary_release_date.lte': '1999-12-31',
        'vote_count.gte': '2500',
      },
    }
  }

  if (mode === 'random') {
    const startYear = 1970 + Math.floor(Math.random() * 46)
    return {
      page: Math.floor(Math.random() * 20) + 1,
      pageWindow: 5,
      query: {
        include_adult: 'false',
        include_video: 'false',
        language: 'en-US',
        sort_by: 'popularity.desc',
        'primary_release_date.gte': `${startYear}-01-01`,
        'primary_release_date.lte': `${startYear + 9}-12-31`,
        'vote_count.gte': '120',
      },
    }
  }

  return {
    page: Math.floor(Math.random() * 8) + 1,
    pageWindow: 4,
    query: {
      include_adult: 'false',
      include_video: 'false',
      language: 'en-US',
      sort_by: 'popularity.desc',
      'vote_count.gte': '1500',
      with_original_language: 'en',
    },
  }
}

function mapTmdbMovie(movie) {
  const director = movie.credits?.crew?.find((person) => person.job === 'Director')?.name ?? 'Unknown'

  return {
    id: movie.id,
    title: movie.title,
    year: movie.release_date ? movie.release_date.slice(0, 4) : 'Unknown',
    director,
    plot: movie.overview || 'Plot not available.',
    poster_link: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : '',
    rating: typeof movie.vote_average === 'number' ? movie.vote_average.toFixed(1) : '0.0',
    genres: Array.isArray(movie.genres) ? movie.genres.slice(0, 3).map((genre) => genre.name) : [],
    runtime: movie.runtime ?? null,
    cast: Array.isArray(movie.credits?.cast)
      ? movie.credits.cast.slice(0, 3).map((person) => person.name)
      : [],
    vote_count: movie.vote_count ?? 0,
  }
}

async function fetchTmdbJson(path, query = {}) {
  const response = await fetch(buildTmdbUrl(path, query), {
    headers: getTmdbAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`TMDb request failed with status ${response.status}`)
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

function createVideoTitle(video, index) {
  if (video.title?.trim()) {
    return video.title.trim()
  }

  return `YouTube Video ${index + 1}`
}

function normalizeStoredVideo(video, index) {
  const baseId = video?.id ?? ''
  const uniqueId = video?.uniqueId ?? `${baseId}-${index}-${Date.now()}`

  return {
    id: baseId,
    url: video?.url ?? '',
    platform: video?.platform ?? 'youtube',
    uniqueId,
    title: createVideoTitle(video, index),
    note: video?.note?.trim?.() ?? '',
    addedAt: video?.addedAt ?? new Date().toISOString(),
  }
}

function getDefaultVideos() {
  return [
    {
      id: 'dQw4w9WgXcQ',
      uniqueId: 'dQw4w9WgXcQ-seed-1',
      url: 'https://youtu.be/dQw4w9WgXcQ?si=o3sH1bKCqKNA7Wod',
      platform: 'youtube',
      title: 'Starter Video 1',
      note: 'Initial sample video',
      addedAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'jNQXAC9IVRw',
      uniqueId: 'jNQXAC9IVRw-seed-2',
      url: 'https://youtu.be/jNQXAC9IVRw?si=0jM_kGMgO4efwUoV',
      platform: 'youtube',
      title: 'Starter Video 2',
      note: 'Quick default pick',
      addedAt: '2026-01-01T09:05:00.000Z',
    },
    {
      id: 'XqZsoesa55w',
      uniqueId: 'XqZsoesa55w-seed-3',
      url: 'https://youtu.be/XqZsoesa55w?si=Yc_1TogJku2Y2-58',
      platform: 'youtube',
      title: 'Starter Video 3',
      note: 'Kid-friendly example',
      addedAt: '2026-01-01T09:10:00.000Z',
    },
    {
      id: 'JnTa9XtvmfI',
      uniqueId: 'JnTa9XtvmfI-seed-4',
      url: 'https://www.youtube.com/watch?v=JnTa9XtvmfI',
      platform: 'youtube',
      title: 'Starter Video 4',
      note: 'Music pick',
      addedAt: '2026-01-01T09:15:00.000Z',
    },
  ]
}

function readStoredVideos() {
  try {
    const storedVideos = localStorage.getItem(VIDEO_STORAGE_KEY)
    if (!storedVideos) {
      return []
    }

    const parsedVideos = JSON.parse(storedVideos)
    if (!Array.isArray(parsedVideos)) {
      return []
    }

    return parsedVideos.map(normalizeStoredVideo)
  } catch (error) {
    console.error('Error retrieving videos from local storage:', error)
    return []
  }
}

function writeStoredVideos(videos) {
  localStorage.setItem(
    VIDEO_STORAGE_KEY,
    JSON.stringify(videos.map((video, index) => normalizeStoredVideo(video, index))),
  )
  localStorage.setItem(VIDEO_OPENED_KEY, 'true')
}

export default {
  // Steam Game Comparison methods
  async getAllGames() {
    const cachedGames = readCachedSteamGames()
    if (cachedGames) {
      return cachedGames
    }

    try {
      const response = await fetch('/api/steam-games')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const games = await response.json()
      if (Array.isArray(games) && games.length > 0) {
        saveCachedSteamGames(games)
        return games
      }

      throw new Error('Steam games API returned no usable records.')
    } catch (error) {
      console.error('Error fetching games:', error)

      try {
        const response = await fetch('/all_games.json')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        return await response.json()
      } catch (fallbackError) {
        console.error('Error fetching fallback Steam JSON:', fallbackError)
        return []
      }
    }
  },

  async getSteamGameStats(appid) {
    const cachedStats = readCachedSteamGameStats(appid)
    if (cachedStats) {
      return cachedStats
    }

    const response = await fetch(`/api/steam-game?appid=${encodeURIComponent(appid)}`)
    if (!response.ok) {
      throw new Error(`Steam game stats request failed with status ${response.status}`)
    }

    const stats = await response.json()
    saveCachedSteamGameStats(appid, stats)
    return stats
  },

  // IMDB Guessr methods
  async getMovies(mode = 'popular', options = {}) {
    try {
      const cachedMovies = options.forceRefresh ? null : readCachedMovies(mode)
      if (cachedMovies) {
        console.log(`[movies] source=tmdb-cache mode=${mode} count=${cachedMovies.length}`)
        return cachedMovies
      }

      const discoveryConfig = getTmdbDiscoveryConfig(mode)
      const pageWindow = discoveryConfig.pageWindow ?? 3
      const maxPage = mode === 'random' ? 20 : mode === 'classic' ? 12 : 8
      const pages = Array.from({ length: pageWindow }, (_, index) => {
        const candidate = discoveryConfig.page + index
        return candidate > maxPage ? ((candidate - 1) % maxPage) + 1 : candidate
      })

      const discoveryResponses = await Promise.all(
        pages.map((page) =>
          fetchTmdbJson('/discover/movie', {
            ...discoveryConfig.query,
            page: page.toString(),
          }),
        ),
      )

      const movieIds = shuffleArray(
        Array.from(
          new Set(
            discoveryResponses.flatMap((response) => (response.results ?? []).map((movie) => movie.id)),
          ),
        ),
      ).slice(0, 40)

      const detailedMovies = await Promise.all(
        movieIds.map((movieId) =>
          fetchTmdbJson(`/movie/${movieId}`, {
            append_to_response: 'credits',
            language: 'en-US',
          }),
        ),
      )

      const movies = detailedMovies
        .map(mapTmdbMovie)
        .filter((movie) => movie.poster_link && movie.plot && movie.rating !== '0.0')

      if (movies.length > 0) {
        console.log(
          `[movies] source=tmdb mode=${mode} count=${movies.length} pages=${pages.join(',')}`,
        )
        saveCachedMovies(mode, movies)
        return movies
      }

      throw new Error('TMDb returned no usable movie records.')
    } catch (error) {
      console.error('Error fetching movies from TMDb:', error)

      try {
        const response = await fetch('/all_movies.json')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const fallbackMovies = await response.json()
        console.log(`[movies] source=json-fallback mode=${mode} count=${fallbackMovies.length}`)
        return fallbackMovies
      } catch (fallbackError) {
        console.error('Error fetching fallback movie JSON:', fallbackError)
        console.log(`[movies] source=hardcoded-fallback mode=${mode} count=1`)
        return [
          {
            id: 1,
            title: 'The Shawshank Redemption',
            year: 1994,
            director: 'Frank Darabont',
            actors: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton'],
            plot: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
            poster:
              'https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_.jpg',
            rating: 9.3,
          },
        ]
      }
    }
  },

  // Video Watcher methods
  async getVideos() {
    const isOpenedBefore = localStorage.getItem(VIDEO_OPENED_KEY) === 'true'
    const storedVideos = readStoredVideos()

    if (isOpenedBefore && storedVideos.length > 0) {
      writeStoredVideos(storedVideos)
      return storedVideos
    }

    const defaultVideos = getDefaultVideos()
    writeStoredVideos(defaultVideos)
    return defaultVideos
  },

  async addVideo(videoData) {
    try {
      const videos = readStoredVideos()
      videos.push(normalizeStoredVideo(videoData, videos.length))
      writeStoredVideos(videos)

      console.log('Adding video to local storage:', videoData)
      return { success: true }
    } catch (error) {
      console.error('Error adding video to local storage:', error)
      return { success: false, error: error.message }
    }
  },

  async saveVideos(videos) {
    try {
      writeStoredVideos(videos)
      return { success: true, videos: readStoredVideos() }
    } catch (error) {
      console.error('Error saving videos to local storage:', error)
      return { success: false, error: error.message }
    }
  },

  async clearVideos() {
    try {
      writeStoredVideos([])
      return { success: true, videos: [] }
    } catch (error) {
      console.error('Error clearing videos from local storage:', error)
      return { success: false, error: error.message }
    }
  },

  async removeVideo(videoId, uniqueId) {
    try {
      const videos = readStoredVideos()
      const initialLength = videos.length
      const filteredVideos = videos.filter((video) => {
        if (uniqueId) {
          return video.uniqueId !== uniqueId
        }

        return video.id !== videoId
      })

      if (filteredVideos.length === initialLength) {
        return { success: false, error: 'Video not found' }
      }

      writeStoredVideos(filteredVideos)

      console.log('Removed video from local storage:', uniqueId ?? videoId)
      return { success: true, videos: filteredVideos }
    } catch (error) {
      console.error('Error removing video from local storage:', error)
      return { success: false, error: error.message }
    }
  },
}
