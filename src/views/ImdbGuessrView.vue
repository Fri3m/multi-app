<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'

const STORAGE_KEYS = {
  highScore: 'imdb-guessr-highscore',
  rankPoints: 'imdb-guessr-rank-points',
  peakRankPoints: 'imdb-guessr-peak-rank-points',
  peakStreak: 'imdb-guessr-peak-streak',
  recentMoviesPrefix: 'imdb-guessr-recent-movies',
}

const RANKS = [
  { minPoints: -9999, label: 'Lost in the Lobby' },
  { minPoints: 0, label: 'Film Student' },
  { minPoints: 200, label: 'Indie Critic' },
  { minPoints: 450, label: 'Festival Judge' },
  { minPoints: 750, label: 'Movie Oracle' },
  { minPoints: 1100, label: 'Cinema Legend' },
]

const SOURCE_MODES = [
  {
    id: 'popular',
    title: 'Popular Films',
    description: 'Widely known, high-traffic crowd favorites.',
  },
  {
    id: 'classic',
    title: 'Classic Films',
    description: 'Older landmark films pulled from earlier decades.',
  },
  {
    id: 'random',
    title: 'Random Films',
    description: 'A broader rotating pool with less predictable picks.',
  },
]

const DIFFICULTIES = [
  {
    id: 'easy',
    title: 'Easy',
    description: 'More lives, more hints, lighter target.',
    lives: 4,
    hints: 5,
    targetScore: 80,
    hintPenalty: 2,
    rankGain: 18,
    rankLoss: 8,
    ratingThresholds: [0.4, 0.8, 1.3, 1.8],
    higherLowerMinGap: 0.8,
  },
  {
    id: 'medium',
    title: 'Medium',
    description: 'Balanced default run.',
    lives: 3,
    hints: 3,
    targetScore: 100,
    hintPenalty: 3,
    rankGain: 32,
    rankLoss: 14,
    ratingThresholds: [0.2, 0.5, 1, 1.5],
    higherLowerMinGap: 0.5,
  },
  {
    id: 'hard',
    title: 'Hard',
    description: 'Fewer hints and tighter grading.',
    lives: 2,
    hints: 2,
    targetScore: 130,
    hintPenalty: 4,
    rankGain: 50,
    rankLoss: 22,
    ratingThresholds: [0.1, 0.3, 0.7, 1.1],
    higherLowerMinGap: 0.25,
  },
]

const CHALLENGE_TYPES = [
  {
    id: 'rating',
    title: 'TMDb Rating Guess',
    description: 'Estimate the exact TMDb score from 1.0 to 10.0.',
  },
  {
    id: 'genre',
    title: 'Genre Guess',
    description: 'Pick the genre that best matches the featured film.',
  },
  {
    id: 'higher-lower',
    title: 'Higher / Lower',
    description: 'Pick which film has the higher TMDb rating.',
  },
]

const movies = ref([])
const currentMovie = ref(null)
const comparisonMovie = ref(null)
const usedMovieIds = ref([])
const userGuess = ref(5.5)
const guessSubmitted = ref(false)
const feedback = ref('')
const score = ref(0)
const highScore = ref(0)
const loading = ref(true)
const error = ref(null)
const lives = ref(3)
const streak = ref(0)
const bestStreak = ref(0)
const round = ref(1)
const runFinished = ref(false)
const winState = ref(false)
const roundPoints = ref(0)
const milestoneMessage = ref('')
const selectedMode = ref('popular')
const selectedDifficulty = ref('medium')
const currentChallenge = ref('rating')
const hintsRemaining = ref(0)
const revealedHintCount = ref(0)
const hintPenaltyThisRound = ref(0)
const roundDetail = ref('')
const revealLine = ref('')
const submittedAnswer = ref('')
const genreOptions = ref([])
const outcomeTone = ref('neutral')
const selectedAnswer = ref(null)
const correctAnswer = ref(null)
const recentMovieIds = ref([])
const rankPoints = ref(100)
const rankDelta = ref(0)
const peakStreak = ref(0)

const RECENT_MOVIE_MEMORY_LIMIT = 36

onMounted(async () => {
  recentMovieIds.value = loadRecentMovieIds(selectedMode.value)
  await loadMoviesForMode(selectedMode.value)
})

const selectedDifficultyConfig = computed(() => {
  return DIFFICULTIES.find((difficulty) => difficulty.id === selectedDifficulty.value) ?? DIFFICULTIES[1]
})

const scoreTarget = computed(() => selectedDifficultyConfig.value.targetScore)

const currentChallengeMeta = computed(() => {
  return (
    CHALLENGE_TYPES.find((challenge) => challenge.id === currentChallenge.value) ?? CHALLENGE_TYPES[0]
  )
})

const activeMovieCards = computed(() => {
  return comparisonMovie.value
    ? [
        { side: 'left', movie: currentMovie.value },
        { side: 'right', movie: comparisonMovie.value },
      ]
    : [{ side: 'solo', movie: currentMovie.value }]
})

const revealedHints = computed(() => {
  return getHintsForCurrentRound().slice(0, revealedHintCount.value)
})

const hasMoreHints = computed(() => {
  return hintsRemaining.value > 0 && revealedHintCount.value < getHintsForCurrentRound().length
})

async function loadMoviesForMode(mode, options = {}) {
  try {
    loading.value = true
    error.value = null

    const savedHighScore = localStorage.getItem(STORAGE_KEYS.highScore)
    if (savedHighScore) {
      highScore.value = parseInt(savedHighScore, 10)
    }

    const savedRankPoints = parseInt(localStorage.getItem(STORAGE_KEYS.rankPoints) ?? '100', 10)
    rankPoints.value = Number.isNaN(savedRankPoints) ? 100 : savedRankPoints

    const savedPeakRankPoints = parseInt(
      localStorage.getItem(STORAGE_KEYS.peakRankPoints) ?? rankPoints.value.toString(),
      10,
    )
    const normalizedPeakRankPoints = Number.isNaN(savedPeakRankPoints)
      ? rankPoints.value
      : Math.max(rankPoints.value, savedPeakRankPoints)
    localStorage.setItem(STORAGE_KEYS.peakRankPoints, normalizedPeakRankPoints.toString())

    const savedPeakStreak = parseInt(localStorage.getItem(STORAGE_KEYS.peakStreak) ?? '0', 10)
    peakStreak.value = Number.isNaN(savedPeakStreak) ? 0 : savedPeakStreak

    movies.value = await api.getMovies(mode, options)
    startNewRun()
  } catch (err) {
    error.value = 'Failed to load movies: ' + err.message
  } finally {
    loading.value = false
  }
}

async function selectMode(mode) {
  if (selectedMode.value === mode && movies.value.length > 0) return

  selectedMode.value = mode
  recentMovieIds.value = loadRecentMovieIds(mode)
  await loadMoviesForMode(mode)
}

function selectDifficulty(difficultyId) {
  if (selectedDifficulty.value === difficultyId) return

  selectedDifficulty.value = difficultyId
  startNewRun()
}

function startNewRun() {
  score.value = 0
  lives.value = selectedDifficultyConfig.value.lives
  streak.value = 0
  bestStreak.value = 0
  round.value = 1
  runFinished.value = false
  winState.value = false
  roundPoints.value = 0
  feedback.value = ''
  milestoneMessage.value = ''
  usedMovieIds.value = []
  hintsRemaining.value = selectedDifficultyConfig.value.hints
  revealedHintCount.value = 0
  hintPenaltyThisRound.value = 0
  roundDetail.value = ''
  revealLine.value = ''
  submittedAnswer.value = ''
  genreOptions.value = []
  outcomeTone.value = 'neutral'
  selectedAnswer.value = null
  correctAnswer.value = null
  rankDelta.value = 0
  selectRandomMovie()
}

function getMovieIdentifier(movie) {
  return movie.id ?? `${movie.title}-${movie.year}`
}

function getRecentMoviesStorageKey(mode) {
  return `${STORAGE_KEYS.recentMoviesPrefix}-${mode}`
}

function loadRecentMovieIds(mode) {
  try {
    const storedValue = localStorage.getItem(getRecentMoviesStorageKey(mode))
    if (!storedValue) return []

    const parsedValue = JSON.parse(storedValue)
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch (error) {
    console.error('Error loading recent movie ids:', error)
    return []
  }
}

function rememberMovieIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return

  const mergedIds = [...recentMovieIds.value, ...ids.filter(Boolean)]
  const uniqueIds = Array.from(new Set(mergedIds))
  const trimmedIds = uniqueIds.slice(-RECENT_MOVIE_MEMORY_LIMIT)

  recentMovieIds.value = trimmedIds

  try {
    localStorage.setItem(getRecentMoviesStorageKey(selectedMode.value), JSON.stringify(trimmedIds))
  } catch (error) {
    console.error('Error saving recent movie ids:', error)
  }
}

function getUnusedMovies(excludedIds = [], ignoreRecent = false) {
  return movies.value.filter((movie) => {
    const identifier = getMovieIdentifier(movie)
    return (
      !usedMovieIds.value.includes(identifier) &&
      !excludedIds.includes(identifier) &&
      (ignoreRecent || !recentMovieIds.value.includes(identifier))
    )
  })
}

async function ensureFreshMoviePool(requiredMovieCount = 1) {
  const unusedCount = getUnusedMovies().length
  if (unusedCount >= Math.max(requiredMovieCount, 8)) {
    return false
  }

  try {
    const refreshedMovies = await api.getMovies(selectedMode.value, { forceRefresh: true })
    if (Array.isArray(refreshedMovies) && refreshedMovies.length > 0) {
      movies.value = refreshedMovies
      usedMovieIds.value = []
      return true
    }
  } catch (error) {
    console.error('Error refreshing movie pool:', error)
  }

  return false
}

function pickRandomMovie(excludedIds = []) {
  let availableMovies = getUnusedMovies(excludedIds)
  if (availableMovies.length === 0) {
    availableMovies = getUnusedMovies(excludedIds, true)
  }
  if (availableMovies.length === 0) return null

  const randomIndex = Math.floor(Math.random() * availableMovies.length)
  return availableMovies[randomIndex]
}

function pickComparisonMovie(primaryMovie) {
  const primaryIdentifier = getMovieIdentifier(primaryMovie)
  const gapTarget = selectedDifficultyConfig.value.higherLowerMinGap
  let pool = getUnusedMovies([primaryIdentifier])
  if (pool.length === 0) {
    pool = getUnusedMovies([primaryIdentifier], true)
  }
  if (pool.length === 0) return null

  const primaryRating = parseFloat(primaryMovie.rating)
  const filteredPool = pool.filter((movie) => {
    return Math.abs(parseFloat(movie.rating) - primaryRating) >= gapTarget
  })

  const candidates = filteredPool.length > 0 ? filteredPool : pool
  const randomIndex = Math.floor(Math.random() * candidates.length)
  return candidates[randomIndex]
}

function chooseRandomChallenge() {
  const availableChallenges = CHALLENGE_TYPES.filter((challenge) => {
    if (challenge.id === 'genre') {
      return movies.value.some((movie) => Array.isArray(movie.genres) && movie.genres.length > 0)
    }

    return true
  })

  const randomIndex = Math.floor(Math.random() * availableChallenges.length)
  return availableChallenges[randomIndex].id
}

async function selectRandomMovie() {
  if (movies.value.length === 0) return

  currentChallenge.value = chooseRandomChallenge()
  const requiredMovieCount = currentChallenge.value === 'higher-lower' ? 2 : 1

  if (getUnusedMovies().length < requiredMovieCount) {
    const refreshed = await ensureFreshMoviePool(requiredMovieCount)
    if (!refreshed) {
      usedMovieIds.value = []
    }
  }

  const primaryMovie = pickRandomMovie()
  if (!primaryMovie) return

  currentMovie.value = primaryMovie
  comparisonMovie.value = null

  const idsToMark = [getMovieIdentifier(primaryMovie)]

  if (currentChallenge.value === 'higher-lower') {
    const secondaryMovie = pickComparisonMovie(primaryMovie)
    if (!secondaryMovie) {
      const refreshed = await ensureFreshMoviePool(2)
      if (!refreshed) {
        usedMovieIds.value = []
      }
      await selectRandomMovie()
      return
    }

    comparisonMovie.value = secondaryMovie
    idsToMark.push(getMovieIdentifier(secondaryMovie))
  }

  if (currentChallenge.value === 'genre' && (!primaryMovie.genres || primaryMovie.genres.length === 0)) {
    selectRandomMovie()
    return
  }

  usedMovieIds.value.push(...idsToMark)
  rememberMovieIds(idsToMark)
  userGuess.value = 5.5
  guessSubmitted.value = false
  feedback.value = ''
  roundPoints.value = 0
  roundDetail.value = ''
  revealLine.value = ''
  submittedAnswer.value = ''
  revealedHintCount.value = 0
  hintPenaltyThisRound.value = 0
  genreOptions.value = currentChallenge.value === 'genre' ? buildGenreOptions(primaryMovie) : []
  outcomeTone.value = 'neutral'
  selectedAnswer.value = null
  correctAnswer.value = null
  rankDelta.value = 0
  milestoneMessage.value = isPremiereRound.value
    ? 'Premiere Round: rewards are boosted, but misses hurt more.'
    : ''
}

function getRatingRoundResult(difference, isPremiere) {
  const thresholds = selectedDifficultyConfig.value.ratingThresholds
  const rewardMultiplier = isPremiere ? 2 : 1

  if (difference <= thresholds[0]) {
    return {
      label: 'Perfect take',
      points: 12 * rewardMultiplier,
      lifeChange: 1,
      streakChange: 1,
    }
  }

  if (difference <= thresholds[1]) {
    return {
      label: 'Critic approved',
      points: 8 * rewardMultiplier,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  if (difference <= thresholds[2]) {
    return {
      label: 'Solid review',
      points: 5 * rewardMultiplier,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  if (difference <= thresholds[3]) {
    return {
      label: 'Shaky call',
      points: 2,
      lifeChange: isPremiere ? -2 : -1,
      streakChange: -streak.value,
    }
  }

  return {
    label: 'Box office disaster',
    points: 0,
    lifeChange: isPremiere ? -2 : -1,
    streakChange: -streak.value,
  }
}

function shuffleArray(items) {
  const clone = [...items]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
  }

  return clone
}

function buildGenreOptions(movie) {
  const primaryGenre = movie.genres?.[0]
  const fallbackGenres = ['Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Crime']

  if (!primaryGenre) {
    return shuffleArray(fallbackGenres).slice(0, 4)
  }

  const decoyGenres = Array.from(
    new Set(
      movies.value
        .flatMap((entry) => entry.genres ?? [])
        .filter((genre) => genre && genre !== primaryGenre),
    ),
  )

  const optionPool =
    decoyGenres.length > 0 ? decoyGenres : fallbackGenres.filter((genre) => genre !== primaryGenre)

  return shuffleArray([primaryGenre, ...shuffleArray(optionPool).slice(0, 3)]).slice(0, 4)
}

function getGenreRoundResult(isCorrect, isPremiere) {
  if (isCorrect) {
    return {
      label: 'Genre nailed',
      points: isPremiere ? 18 : 9,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  return {
    label: 'Genre miss',
    points: 0,
    lifeChange: isPremiere ? -2 : -1,
    streakChange: -streak.value,
  }
}

function getHigherLowerRoundResult(isCorrect, isPremiere) {
  if (isCorrect) {
    return {
      label: 'Sharp read',
      points: isPremiere ? 20 : 10,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  return {
    label: 'Bad matchup',
    points: 0,
    lifeChange: isPremiere ? -2 : -1,
    streakChange: -streak.value,
  }
}

function applyRoundOutcome(result, detailLine, revealText, answerText, meta = {}) {
  guessSubmitted.value = true

  const comboBonus = result.streakChange > 0 ? Math.min(streak.value, 4) : 0
  const penalty = hintPenaltyThisRound.value
  const totalPoints = Math.max(0, result.points + comboBonus - penalty)

  roundPoints.value = totalPoints
  roundDetail.value = detailLine
  revealLine.value = revealText
  submittedAnswer.value = answerText
  outcomeTone.value = meta.tone ?? 'neutral'
  selectedAnswer.value = meta.selectedAnswer ?? null
  correctAnswer.value = meta.correctAnswer ?? null
  score.value += totalPoints
  lives.value = Math.min(5, Math.max(0, lives.value + result.lifeChange))

  if (result.streakChange > 0) {
    streak.value += 1
    bestStreak.value = Math.max(bestStreak.value, streak.value)
    peakStreak.value = Math.max(peakStreak.value, bestStreak.value)
    localStorage.setItem(STORAGE_KEYS.peakStreak, peakStreak.value.toString())
  } else {
    streak.value = 0
  }

  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem(STORAGE_KEYS.highScore, highScore.value.toString())
  }

  const lifeMessage =
    result.lifeChange > 0
      ? 'Bonus life earned.'
      : result.lifeChange < 0
        ? `${Math.abs(result.lifeChange)} life lost.`
        : 'Lives unchanged.'

  const comboMessage = comboBonus > 0 ? ` Combo bonus +${comboBonus}.` : ''
  const premiereMessage = isPremiereRound.value ? ' Premiere round applied.' : ''
  const hintMessage = penalty > 0 ? ` Hint penalty -${penalty}.` : ''

  feedback.value = `${result.label}! +${totalPoints} score. ${lifeMessage}${comboMessage}${premiereMessage}${hintMessage}`

  if (score.value >= scoreTarget.value) {
    finishRun(true)
    return
  }

  if (lives.value <= 0) {
    finishRun(false)
  }
}

function submitGuess() {
  if (runFinished.value || guessSubmitted.value) return

  const actualRating = parseFloat(currentMovie.value.rating)
  const difference = Math.abs(userGuess.value - actualRating)
  const result = getRatingRoundResult(difference, isPremiereRound.value)
  const tone =
    difference <= selectedDifficultyConfig.value.ratingThresholds[1]
      ? 'success'
      : difference <= selectedDifficultyConfig.value.ratingThresholds[2]
        ? 'warning'
        : 'failure'

  applyRoundOutcome(
    result,
    `You were ${difference.toFixed(1)} away from the TMDb rating.`,
    `Actual TMDb rating: ${actualRating.toFixed(1)}`,
    `Your guess: ${userGuess.value.toFixed(1)}`,
    {
      tone,
    },
  )
}

function submitGenreGuess(genre) {
  if (runFinished.value || guessSubmitted.value) return

  const primaryGenre = currentMovie.value.genres?.[0] ?? 'Unknown'
  const isCorrect = genre === primaryGenre
  const result = getGenreRoundResult(isCorrect, isPremiereRound.value)

  applyRoundOutcome(
    result,
    `Primary genre: ${primaryGenre}.`,
    `All tagged genres: ${(currentMovie.value.genres ?? []).join(', ') || 'Unavailable'}`,
    `You picked: ${genre}`,
    {
      tone: isCorrect ? 'success' : 'failure',
      selectedAnswer: genre,
      correctAnswer: primaryGenre,
    },
  )
}

function submitHigherLowerGuess(selection) {
  if (runFinished.value || guessSubmitted.value || !comparisonMovie.value) return

  const leftRating = parseFloat(currentMovie.value.rating)
  const rightRating = parseFloat(comparisonMovie.value.rating)
  const correctAnswer = leftRating >= rightRating ? 'left' : 'right'
  const isCorrect = selection === correctAnswer
  const result = getHigherLowerRoundResult(isCorrect, isPremiereRound.value)

  applyRoundOutcome(
    result,
    `The rating gap was ${Math.abs(leftRating - rightRating).toFixed(1)} points.`,
    `Left: ${leftRating.toFixed(1)} | Right: ${rightRating.toFixed(1)}`,
    `You picked: ${selection === 'left' ? currentMovie.value.title : comparisonMovie.value.title}`,
    {
      tone: isCorrect ? 'success' : 'failure',
      selectedAnswer: selection,
      correctAnswer,
    },
  )
}

function useHint() {
  if (!hasMoreHints.value || guessSubmitted.value || runFinished.value) return

  revealedHintCount.value += 1
  hintPenaltyThisRound.value += selectedDifficultyConfig.value.hintPenalty
  hintsRemaining.value -= 1
}

function formatMovieHint(movie, hintType) {
  if (hintType === 'year') {
    return `${movie.title}: released in ${movie.year}`
  }

  if (hintType === 'decade') {
    const year = parseInt(movie.year, 10)
    const decade = Number.isNaN(year) ? 'an unknown decade' : `${Math.floor(year / 10) * 10}s`
    return `${movie.title}: from the ${decade}`
  }

  if (hintType === 'director') {
    return `${movie.title}: directed by ${movie.director || 'Unknown'}`
  }

  if (hintType === 'genres') {
    return `${movie.title}: ${movie.genres?.join(', ') || 'Genres unavailable'}`
  }

  if (hintType === 'cast') {
    return `${movie.title}: ${movie.cast?.join(', ') || 'Cast unavailable'}`
  }

  return `${movie.title}: ${movie.runtime ? `${movie.runtime} minutes` : 'Runtime unavailable'}`
}

function getHintsForCurrentRound() {
  if (!currentMovie.value) return []

  if (currentChallenge.value === 'higher-lower' && comparisonMovie.value) {
    return [
      `${formatMovieHint(currentMovie.value, 'year')} | ${formatMovieHint(comparisonMovie.value, 'year')}`,
      `${formatMovieHint(currentMovie.value, 'director')} | ${formatMovieHint(comparisonMovie.value, 'director')}`,
      `${formatMovieHint(currentMovie.value, 'genres')} | ${formatMovieHint(comparisonMovie.value, 'genres')}`,
      `${formatMovieHint(currentMovie.value, 'cast')} | ${formatMovieHint(comparisonMovie.value, 'cast')}`,
    ]
  }

  if (currentChallenge.value === 'genre') {
    return [
      formatMovieHint(currentMovie.value, 'year'),
      formatMovieHint(currentMovie.value, 'director'),
      formatMovieHint(currentMovie.value, 'cast'),
      formatMovieHint(currentMovie.value, 'runtime'),
    ]
  }

  return [
    formatMovieHint(currentMovie.value, 'year'),
    formatMovieHint(currentMovie.value, 'director'),
    formatMovieHint(currentMovie.value, 'genres'),
    formatMovieHint(currentMovie.value, 'cast'),
  ]
}

function finishRun(didWin) {
  runFinished.value = true
  winState.value = didWin
  const delta = didWin
    ? selectedDifficultyConfig.value.rankGain
    : -selectedDifficultyConfig.value.rankLoss
  rankDelta.value = delta
  rankPoints.value += delta
  localStorage.setItem(STORAGE_KEYS.rankPoints, rankPoints.value.toString())

  const peakRankPoints = parseInt(
    localStorage.getItem(STORAGE_KEYS.peakRankPoints) ?? rankPoints.value.toString(),
    10,
  )
  if (rankPoints.value >= peakRankPoints) {
    localStorage.setItem(STORAGE_KEYS.peakRankPoints, rankPoints.value.toString())
  }

  if (didWin) {
    feedback.value = `Run cleared! You reached ${score.value} points and earned +${selectedDifficultyConfig.value.rankGain} rank points.`
  } else {
    feedback.value = `Run over. You finished with ${score.value} points and lost ${selectedDifficultyConfig.value.rankLoss} rank points.`
  }
}

function nextMovie() {
  if (runFinished.value) return
  round.value += 1
  selectRandomMovie()
}

const posterSrc = computed(() => {
  return currentMovie.value?.poster_link || currentMovie.value?.poster || ''
})

const isPremiereRound = computed(() => {
  return round.value > 0 && round.value % 5 === 0
})

const currentRankIndex = computed(() => {
  let index = 0

  for (let i = 0; i < RANKS.length; i += 1) {
    if (rankPoints.value >= RANKS[i].minPoints) {
      index = i
    }
  }

  return index
})

const currentRank = computed(() => {
  return RANKS[currentRankIndex.value].label
})

const peakRankPoints = computed(() => {
  return parseInt(localStorage.getItem(STORAGE_KEYS.peakRankPoints) ?? rankPoints.value.toString(), 10)
})

const peakRankLabel = computed(() => {
  let index = 0

  for (let i = 0; i < RANKS.length; i += 1) {
    if (peakRankPoints.value >= RANKS[i].minPoints) {
      index = i
    }
  }

  return RANKS[index].label
})

const progressPercent = computed(() => {
  return Math.min(100, (score.value / scoreTarget.value) * 100)
})

const outcomeHeadline = computed(() => {
  if (outcomeTone.value === 'success') return 'Correct'
  if (outcomeTone.value === 'failure') return 'Wrong'
  if (outcomeTone.value === 'warning') return 'Close Call'
  return 'Round Result'
})

function getMovieCardState(side) {
  if (!guessSubmitted.value || currentChallenge.value !== 'higher-lower') return ''
  if (correctAnswer.value === side) return 'success'
  if (selectedAnswer.value === side && selectedAnswer.value !== correctAnswer.value) return 'failure'
  return ''
}
</script>

<template>
  <div class="container-wrapper">
    <div class="imdb-guessr">
      <div v-if="loading" class="loading">Loading movies...</div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <template v-else-if="currentMovie">
        <main class="game-layout">
          <section class="main-stage">
            <div class="stage-header">
              <div>
                <p class="eyebrow">Main Game Screen</p>
                <h1>{{ currentChallengeMeta.title }}</h1>
                <p class="stage-copy">{{ currentChallengeMeta.description }}</p>
              </div>
              <span v-if="isPremiereRound" class="challenge-chip">Premiere Round</span>
            </div>

            <div
              class="movie-grid"
              :class="{ duel: currentChallenge === 'higher-lower', single: currentChallenge !== 'higher-lower' }"
            >
              <article
                v-for="card in activeMovieCards"
                :key="card.side"
                class="movie-card"
                :class="[
                  { duel: currentChallenge === 'higher-lower' },
                  getMovieCardState(card.side),
                ]"
              >
                <div class="movie-poster-frame">
                  <img
                    :src="card.movie?.poster_link || card.movie?.poster || posterSrc"
                    :alt="card.movie?.title"
                  />
                </div>
                <div class="movie-copy">
                  <span v-if="card.side !== 'solo'" class="movie-side-label">
                    {{ card.side === 'left' ? 'Left film' : 'Right film' }}
                  </span>
                  <h2>{{ card.movie?.title }}</h2>
                  <template v-if="currentChallenge !== 'higher-lower'">
                    <p>{{ card.movie?.plot }}</p>
                  </template>
                </div>
              </article>
            </div>

            <div class="play-panel">
              <div class="hint-row">
                <div class="hint-pill">
                  <span>Hints</span>
                  <strong>{{ hintsRemaining }}</strong>
                </div>
                <button
                  type="button"
                  class="hint-button"
                  :disabled="!hasMoreHints || guessSubmitted || runFinished"
                  @click="useHint"
                >
                  Reveal clue (-{{ selectedDifficultyConfig.hintPenalty }})
                </button>
              </div>

              <div v-if="revealedHints.length > 0" class="hint-list">
                <p class="hint-list-title">Clues in play</p>
                <ul>
                  <li v-for="hint in revealedHints" :key="hint">{{ hint }}</li>
                </ul>
              </div>

              <div v-if="!guessSubmitted" class="guess-shell">
                <template v-if="currentChallenge === 'rating'">
                  <div class="slider-readout">{{ userGuess.toFixed(1) }}</div>
                  <input type="range" v-model.number="userGuess" min="1" max="10" step="0.1" />
                  <button @click="submitGuess" :disabled="runFinished">Lock rating guess</button>
                </template>

                <template v-else-if="currentChallenge === 'genre'">
                  <div class="choice-grid">
                    <button
                      v-for="genre in genreOptions"
                      :key="genre"
                      @click="submitGenreGuess(genre)"
                      :disabled="runFinished"
                    >
                      {{ genre }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="choice-grid">
                    <button @click="submitHigherLowerGuess('left')" :disabled="runFinished">
                      {{ currentMovie.title }} is higher
                    </button>
                    <button @click="submitHigherLowerGuess('right')" :disabled="runFinished">
                      {{ comparisonMovie?.title }} is higher
                    </button>
                  </div>
                </template>
              </div>

              <div v-else class="result-panel" :class="outcomeTone">
                <div class="result-badge" :class="outcomeTone">{{ outcomeHeadline }}</div>
                <p class="feedback">{{ feedback }}</p>
                <p class="result-line">{{ revealLine }}</p>
                <p class="result-line">{{ submittedAnswer }}</p>
                <p
                  v-if="currentChallenge === 'genre' && correctAnswer"
                  class="result-line"
                >
                  Correct answer: <strong>{{ correctAnswer }}</strong>
                </p>
                <p class="result-line">Round reward: <strong>+{{ roundPoints }}</strong></p>
                <p class="result-line">{{ roundDetail }}</p>

                <button v-if="!runFinished" @click="nextMovie" class="next-button">Next Movie</button>
                <button v-else @click="startNewRun" class="restart-button">
                  {{ winState ? 'Start New Run' : 'Try Again' }}
                </button>
              </div>
            </div>
          </section>

          <aside class="side-column">
            <section class="stats-panel">
              <div class="panel-topline">
                <div>
                  <p class="panel-label">Score & Stats</p>
                  <h2>{{ score }} / {{ scoreTarget }}</h2>
                  <p class="panel-copy">Reach the target before your {{ selectedDifficultyConfig.lives }} lives run out.</p>
                </div>
                <div class="hint-pill compact">
                  <span>Hints</span>
                  <strong>{{ hintsRemaining }}</strong>
                </div>
              </div>

              <div class="progress-bar" aria-hidden="true">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>

              <div class="hud vertical">
                <div class="hud-stat">
                  <span>Lives</span>
                  <strong>{{ '♥'.repeat(lives) }}<span v-if="lives === 0">0</span></strong>
                </div>
                <div class="hud-stat">
                  <span>Round</span>
                  <strong>#{{ round }}</strong>
                </div>
                <div class="hud-stat">
                  <span>Streak</span>
                  <strong>{{ streak }}</strong>
                </div>
                <div class="hud-stat">
                  <span>Rank</span>
                  <strong>{{ rankPoints }} RP</strong>
                  <small>{{ currentRank }}</small>
                </div>
                <div class="hud-stat">
                  <span>Peak Rank</span>
                  <strong>{{ peakRankPoints }} RP</strong>
                  <small>{{ peakRankLabel }}</small>
                </div>
                <div class="hud-stat">
                  <span>Peak Streak</span>
                  <strong>{{ peakStreak }}</strong>
                </div>
              </div>

              <p v-if="milestoneMessage" class="milestone-message">{{ milestoneMessage }}</p>

              <div
                v-if="runFinished"
                class="run-finish-banner"
                :class="{ victory: winState, defeat: !winState }"
              >
                <h2>{{ winState ? 'Festival Cleared' : 'Festival Ended' }}</h2>
                <p>
                  {{
                    winState
                      ? 'You hit the target score and completed the run.'
                      : 'You ran out of lives before reaching the target.'
                  }}
                </p>
                <p class="rank-shift" :class="{ positive: rankDelta > 0, negative: rankDelta < 0 }">
                  Rank change:
                  <strong>{{ rankDelta > 0 ? `+${rankDelta}` : rankDelta }} RP</strong>
                  <span> | {{ currentRank }}</span>
                </p>
              </div>
            </section>

            <section class="settings-panel">
              <div class="control-group">
                <p class="panel-label">Settings</p>
                <div class="segmented-row stacked" aria-label="Movie pools">
                  <button
                    v-for="mode in SOURCE_MODES"
                    :key="mode.id"
                    type="button"
                    class="segment-button"
                    :class="{ active: selectedMode === mode.id }"
                    :disabled="loading"
                    @click="selectMode(mode.id)"
                  >
                    <span>{{ mode.title }}</span>
                    <small>{{ mode.description }}</small>
                  </button>
                </div>
              </div>

              <div class="control-group">
                <p class="picker-label">Difficulty</p>
                <div class="segmented-row stacked" aria-label="Difficulty levels">
                  <button
                    v-for="difficulty in DIFFICULTIES"
                    :key="difficulty.id"
                    type="button"
                    class="segment-button"
                    :class="{ active: selectedDifficulty === difficulty.id }"
                    :disabled="loading"
                    @click="selectDifficulty(difficulty.id)"
                  >
                    <span>{{ difficulty.title }}</span>
                    <small>{{ difficulty.description }}</small>
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
.container-wrapper {
  height: 100vh;
  padding: 1.5rem;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(245, 158, 11, 0.1), transparent 28%),
    linear-gradient(180deg, #08111d 0%, #101826 100%);
}

.imdb-guessr {
  width: min(1380px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: 0;
  color: #f8fafc;
}

.loading,
.error {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  font-size: 1.3rem;
}

.eyebrow,
.picker-label,
.panel-label {
  margin: 0 0 0.55rem;
  font-size: 0.76rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(191, 219, 254, 0.72);
}

.stage-header h1 {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.stage-copy {
  margin: 0.35rem 0 0;
  color: rgba(226, 232, 240, 0.7);
  line-height: 1.5;
}

.challenge-chip {
  display: inline-flex;
  padding: 0.32rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 252, 0.28);
  background: rgba(14, 165, 233, 0.14);
  color: #e0f2fe;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 2.15fr) minmax(310px, 0.95fr);
  gap: 1.1rem;
  height: 100%;
  min-height: 0;
}

.main-stage,
.stats-panel,
.settings-panel {
  background: rgba(9, 16, 30, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.28);
  border-radius: 1rem;
}

.main-stage {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.control-group {
  display: grid;
  gap: 0.7rem;
}

.segmented-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.segmented-row.stacked {
  grid-template-columns: 1fr;
}

.segment-button {
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
  color: inherit;
}

.segment-button span,
.segment-button small {
  display: block;
}

.segment-button span {
  font-size: 0.95rem;
}

.segment-button small {
  margin-top: 0.35rem;
  color: rgba(203, 213, 225, 0.6);
  line-height: 1.4;
}

.segment-button.active {
  border-color: rgba(251, 191, 36, 0.55);
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.14), rgba(249, 115, 22, 0.08));
}

.side-column {
  display: grid;
  grid-template-rows: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 1.1rem;
  min-height: 0;
}

.stats-panel,
.settings-panel {
  padding: 1rem;
  min-height: 0;
  overflow: auto;
}

.panel-topline {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  align-items: flex-start;
}

.panel-topline h2 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: -0.04em;
}

.panel-copy {
  margin: 0.35rem 0 0;
  color: rgba(226, 232, 240, 0.72);
  line-height: 1.5;
}

.hud {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 1rem;
}

.hud-stat {
  padding: 0.85rem 0.9rem;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.hud-stat span {
  display: block;
  margin-bottom: 0.35rem;
  color: rgba(191, 219, 254, 0.65);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hud-stat small {
  display: block;
  margin-top: 0.35rem;
  color: rgba(226, 232, 240, 0.68);
  font-size: 0.88rem;
}

.milestone-message {
  margin: 0.9rem 0 0;
  color: #fbbf24;
}

.movie-grid {
  display: grid;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.movie-grid.duel {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.movie-card {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  min-width: 0;
  min-height: 100%;
}

.movie-card.duel {
  grid-template-columns: 1fr;
  align-content: start;
  gap: 0.75rem;
}

.movie-card.success {
  box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.55);
  border-radius: 1rem;
}

.movie-card.failure {
  box-shadow: inset 0 0 0 2px rgba(248, 113, 113, 0.55);
  border-radius: 1rem;
}

.movie-poster-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem;
  border-radius: 0.95rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(15, 23, 42, 0.72);
  min-height: 380px;
}

.movie-poster-frame img {
  width: 100%;
  max-height: 480px;
  border-radius: 0.75rem;
  object-fit: contain;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.4);
}

.movie-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
  min-height: 0;
  overflow: hidden;
}

.movie-side-label {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.12);
  color: #fef08a;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.movie-copy h2 {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
}

.movie-copy p {
  margin: 0;
  max-width: 42ch;
  color: rgba(226, 232, 240, 0.82);
  line-height: 1.68;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.movie-card.duel .movie-poster-frame {
  min-height: 300px;
}

.movie-card.duel .movie-poster-frame img {
  max-height: 360px;
}

.movie-card.duel .movie-copy {
  justify-content: flex-start;
  gap: 0.45rem;
}

.movie-card.duel .movie-copy h2 {
  font-size: clamp(1.35rem, 2.1vw, 2rem);
  line-height: 1.08;
}

.play-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.25rem;
  flex-shrink: 0;
}

.hint-pill {
  min-width: 88px;
  padding: 0.75rem;
  border-radius: 0.85rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.hint-pill span {
  display: block;
  color: rgba(191, 219, 254, 0.62);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.hint-pill strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.3rem;
}

.hint-pill.compact {
  min-width: 76px;
}

.hint-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.hint-button {
  flex: 1;
  background: linear-gradient(135deg, #0f766e, #0ea5e9);
}

.hint-list {
  padding: 1rem 1.05rem;
  text-align: left;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.hint-list-title {
  margin: 0 0 0.6rem;
  color: #67e8f9;
  font-weight: 700;
}

.hint-list ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--text-secondary);
}

.hint-list li + li {
  margin-top: 0.45rem;
}

.guess-shell,
.result-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-panel {
  padding: 1rem 1.05rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.03);
}

.result-panel.success {
  border-color: rgba(34, 197, 94, 0.35);
  background: linear-gradient(180deg, rgba(22, 163, 74, 0.14), rgba(255, 255, 255, 0.03));
}

.result-panel.failure {
  border-color: rgba(248, 113, 113, 0.35);
  background: linear-gradient(180deg, rgba(185, 28, 28, 0.14), rgba(255, 255, 255, 0.03));
}

.result-panel.warning {
  border-color: rgba(250, 204, 21, 0.35);
  background: linear-gradient(180deg, rgba(202, 138, 4, 0.14), rgba(255, 255, 255, 0.03));
}

.result-badge {
  align-self: flex-start;
  padding: 0.32rem 0.75rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-badge.success {
  background: rgba(34, 197, 94, 0.18);
  color: #bbf7d0;
}

.result-badge.failure {
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
}

.result-badge.warning {
  background: rgba(250, 204, 21, 0.18);
  color: #fde68a;
}

.progress-bar {
  height: 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: 1rem;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f59e0b, #22c55e);
  transition: width 180ms ease;
}

input[type='range'] {
  width: 100%;
}

.slider-readout {
  font-size: 4rem;
  font-weight: bold;
  color: #f8fafc;
  letter-spacing: -0.05em;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

button {
  padding: 0.75rem 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.95rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  color: #f8fafc;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.88), rgba(239, 68, 68, 0.88));
  transition:
    transform var(--transition-speed),
    filter var(--transition-speed),
    border-color var(--transition-speed);
}

button:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
  border-color: rgba(250, 204, 21, 0.36);
}

button:disabled {
  background: var(--disabled-color);
  cursor: not-allowed;
  transform: none;
  filter: none;
}

.feedback {
  margin: 0;
  font-size: 1.2rem;
  color: #fef08a;
}

.result-line {
  margin: 0;
  color: rgba(226, 232, 240, 0.8);
  line-height: 1.6;
}

.restart-button {
  background: linear-gradient(135deg, #10b981, #0f766e);
}

.run-finish-banner {
  padding: 1rem 1.1rem;
  border-radius: 1rem;
  color: white;
  margin-top: 1rem;
}

.run-finish-banner h2,
.run-finish-banner p {
  margin: 0;
}

.run-finish-banner h2 {
  margin-bottom: 0.35rem;
}

.run-finish-banner.victory {
  background: rgba(22, 163, 74, 0.18);
  border: 1px solid rgba(34, 197, 94, 0.45);
}

.run-finish-banner.defeat {
  background: rgba(185, 28, 28, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.45);
}

.rank-shift {
  margin-top: 0.6rem !important;
  color: rgba(226, 232, 240, 0.82);
}

.rank-shift.positive strong {
  color: #86efac;
}

.rank-shift.negative strong {
  color: #fca5a5;
}

@media (max-width: 1200px) {
  .game-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1.45fr) minmax(0, 1fr);
  }

  .side-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: 1fr;
  }
}

@media (max-width: 768px) {
  .container-wrapper,
  .imdb-guessr {
    padding: 1rem;
  }

  .game-layout {
    grid-template-rows: minmax(0, 1.3fr) minmax(0, 1fr);
  }

  .segmented-row,
  .hud,
  .movie-grid,
  .choice-grid,
  .movie-card {
    grid-template-columns: 1fr;
  }

  .movie-poster-frame {
    min-height: auto;
  }

  .movie-card.duel .movie-poster-frame img {
    max-height: 300px;
  }

  .panel-topline {
    flex-direction: column;
  }

  .stage-header {
    flex-direction: column;
  }

  .slider-readout {
    font-size: 3rem;
  }

  .hint-row {
    flex-direction: column;
    align-items: stretch;
  }

  .side-column {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }
}

</style>
