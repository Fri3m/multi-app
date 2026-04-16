<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../services/api'

const STORAGE_KEYS = {
  highScore: 'imdb-guessr-highscore',
  bestRank: 'imdb-guessr-best-rank',
}

const RANKS = [
  { minScore: 0, label: 'Film Student' },
  { minScore: 30, label: 'Indie Critic' },
  { minScore: 70, label: 'Festival Judge' },
  { minScore: 120, label: 'IMDB Oracle' },
]

const movies = ref([])
const currentMovie = ref(null)
const usedMovieIds = ref([])
const userGuess = ref(null)
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
const scoreTarget = ref(100)
const runFinished = ref(false)
const winState = ref(false)
const roundPoints = ref(0)
const lastDifference = ref(null)
const milestoneMessage = ref('')

const windowHeight = ref(window.innerHeight)
const windowWidth = ref(window.innerWidth)

const resizeHandler = () => {
  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
})

onMounted(async () => {
  try {
    loading.value = true

    const savedHighScore = localStorage.getItem(STORAGE_KEYS.highScore)
    if (savedHighScore) {
      highScore.value = parseInt(savedHighScore, 10)
    }

    movies.value = await api.getMovies()
    startNewRun()
  } catch (err) {
    error.value = 'Failed to load movies: ' + err.message
  } finally {
    loading.value = false
  }
})

function startNewRun() {
  score.value = 0
  lives.value = 3
  streak.value = 0
  bestStreak.value = 0
  round.value = 1
  runFinished.value = false
  winState.value = false
  roundPoints.value = 0
  lastDifference.value = null
  feedback.value = ''
  milestoneMessage.value = ''
  usedMovieIds.value = []
  selectRandomMovie()
}

function getMovieIdentifier(movie) {
  return movie.id ?? `${movie.title}-${movie.year}`
}

function selectRandomMovie() {
  if (movies.value.length === 0) return

  const availableMovies = movies.value.filter((movie) => {
    return !usedMovieIds.value.includes(getMovieIdentifier(movie))
  })

  if (availableMovies.length === 0) {
    usedMovieIds.value = []
    selectRandomMovie()
    return
  }

  const randomIndex = Math.floor(Math.random() * availableMovies.length)
  currentMovie.value = availableMovies[randomIndex]
  usedMovieIds.value.push(getMovieIdentifier(currentMovie.value))
  userGuess.value = null
  guessSubmitted.value = false
  feedback.value = ''
  roundPoints.value = 0
  lastDifference.value = null
  milestoneMessage.value = isPremiereRound.value
    ? 'Premiere Round: rewards are boosted, but misses hurt more.'
    : ''
}

function getRoundResult(difference, isPremiere) {
  const rewardMultiplier = isPremiere ? 2 : 1

  if (difference <= 0.2) {
    return {
      label: 'Perfect take',
      points: 12 * rewardMultiplier,
      lifeChange: 1,
      streakChange: 1,
    }
  }

  if (difference <= 0.5) {
    return {
      label: 'Critic approved',
      points: 8 * rewardMultiplier,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  if (difference <= 1) {
    return {
      label: 'Solid review',
      points: 5 * rewardMultiplier,
      lifeChange: 0,
      streakChange: 1,
    }
  }

  if (difference <= 1.5) {
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

function submitGuess() {
  if (userGuess.value === null || runFinished.value) return

  guessSubmitted.value = true

  const actualRating = parseFloat(currentMovie.value.rating)
  const difference = Math.abs(userGuess.value - actualRating)
  const premiereRound = isPremiereRound.value
  const result = getRoundResult(difference, premiereRound)
  const comboBonus = result.streakChange > 0 ? Math.min(streak.value, 4) : 0
  const totalPoints = result.points + comboBonus

  lastDifference.value = difference
  roundPoints.value = totalPoints
  score.value += totalPoints
  lives.value = Math.min(5, Math.max(0, lives.value + result.lifeChange))

  if (result.streakChange > 0) {
    streak.value += 1
    bestStreak.value = Math.max(bestStreak.value, streak.value)
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
  const premiereMessage = premiereRound ? ' Premiere round applied.' : ''

  feedback.value =
    `${result.label}! You were ${difference.toFixed(1)} off. ` +
    `+${totalPoints} score. ${lifeMessage}${comboMessage}${premiereMessage}`

  if (score.value >= scoreTarget.value) {
    finishRun(true)
    return
  }

  if (lives.value <= 0) {
    finishRun(false)
  }
}

function finishRun(didWin) {
  runFinished.value = true
  winState.value = didWin

  const rankIndex = currentRankIndex.value.toString()
  const savedBestRank = parseInt(localStorage.getItem(STORAGE_KEYS.bestRank) ?? '0', 10)
  if (currentRankIndex.value > savedBestRank) {
    localStorage.setItem(STORAGE_KEYS.bestRank, rankIndex)
  }

  if (didWin) {
    feedback.value = `Run cleared! You reached ${score.value} points and became a ${currentRank.value}.`
  } else {
    feedback.value = `Run over. You finished with ${score.value} points as a ${currentRank.value}.`
  }
}

function nextMovie() {
  if (runFinished.value) return
  round.value += 1
  selectRandomMovie()
}

const movieClues = computed(() => {
  if (!currentMovie.value) return {}

  return {
    year: currentMovie.value.year,
    director: currentMovie.value.director,
    plot: currentMovie.value.plot,
  }
})

const posterSrc = computed(() => {
  return currentMovie.value?.poster_link || currentMovie.value?.poster || ''
})

const isPremiereRound = computed(() => {
  return round.value > 0 && round.value % 5 === 0
})

const currentRankIndex = computed(() => {
  let index = 0

  for (let i = 0; i < RANKS.length; i += 1) {
    if (score.value >= RANKS[i].minScore) {
      index = i
    }
  }

  return index
})

const currentRank = computed(() => {
  return RANKS[currentRankIndex.value].label
})

const bestRank = computed(() => {
  const savedIndex = parseInt(localStorage.getItem(STORAGE_KEYS.bestRank) ?? '0', 10)
  return RANKS[Math.min(savedIndex, RANKS.length - 1)].label
})

const progressPercent = computed(() => {
  return Math.min(100, (score.value / scoreTarget.value) * 100)
})
</script>

<template>
  <div class="container-wrapper">
    <div
      class="imdb-guessr"
      :style="{
        height: windowHeight * 0.88 + 'px',
        width: windowWidth * 0.88 + 'px',
      }"
    >
      <div v-if="loading" class="loading">Loading movies...</div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <template v-else-if="currentMovie">
        <div class="hud">
          <div class="hud-card">
            <span class="hud-label">Run Score</span>
            <strong>{{ score }} / {{ scoreTarget }}</strong>
          </div>
          <div class="hud-card">
            <span class="hud-label">Lives</span>
            <strong>{{ '♥'.repeat(lives) }}<span v-if="lives === 0">0</span></strong>
          </div>
          <div class="hud-card">
            <span class="hud-label">Round</span>
            <strong>#{{ round }}</strong>
          </div>
          <div class="hud-card">
            <span class="hud-label">Streak</span>
            <strong>{{ streak }}</strong>
          </div>
          <div class="hud-card">
            <span class="hud-label">Rank</span>
            <strong>{{ currentRank }}</strong>
          </div>
          <div class="hud-card">
            <span class="hud-label">High Score</span>
            <strong>{{ highScore }}</strong>
          </div>
        </div>

        <div class="goal-panel">
          <div class="goal-copy">
            <strong>Objective:</strong> Reach {{ scoreTarget }} score before your 3 lives run out.
            <span v-if="isPremiereRound" class="premiere-badge">Premiere Round</span>
          </div>
          <div class="progress-bar" aria-hidden="true">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="meta-line">Best streak: {{ bestStreak }} | Best rank: {{ bestRank }}</p>
          <p v-if="milestoneMessage" class="milestone-message">{{ milestoneMessage }}</p>
        </div>

        <div class="game-container">
          <div class="movie-poster">
            <img :src="posterSrc" :alt="currentMovie.title" />
          </div>

          <div class="content-container">
            <div class="movie-clues">
              <h2>{{ currentMovie.title }}</h2>
              <p><strong>Year:</strong> {{ movieClues.year }}</p>
              <p><strong>Director:</strong> {{ movieClues.director }}</p>
              <p><strong>Plot:</strong> {{ movieClues.plot }}</p>
            </div>

            <div class="guess-section">
              <h3>Guess the IMDB Rating (1-10)</h3>

              <div v-if="!guessSubmitted" class="guess-input">
                <input type="range" v-model.number="userGuess" min="1" max="10" step="0.1" />
                <div class="guess-value">{{ userGuess ? userGuess.toFixed(1) : '?' }}</div>
                <button @click="submitGuess" :disabled="userGuess === null || runFinished">
                  Submit Guess
                </button>
              </div>

              <div v-else class="result">
                <p class="feedback">{{ feedback }}</p>
                <p class="actual-rating">
                  Actual rating: <strong>{{ parseFloat(currentMovie.rating).toFixed(1) }}</strong>
                </p>
                <p class="your-guess">
                  Your guess: <strong>{{ userGuess.toFixed(1) }}</strong>
                </p>
                <p class="round-summary">
                  Round reward: <strong>+{{ roundPoints }}</strong>
                  <span v-if="lastDifference !== null"> | Difference: {{ lastDifference.toFixed(1) }}</span>
                </p>

                <button v-if="!runFinished" @click="nextMovie" class="next-button">Next Movie</button>
                <button v-else @click="startNewRun" class="restart-button">
                  {{ winState ? 'Start New Run' : 'Try Again' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="runFinished" class="run-finish-banner" :class="{ victory: winState, defeat: !winState }">
          <h2>{{ winState ? 'Festival Cleared' : 'Festival Ended' }}</h2>
          <p>
            {{ winState ? 'You hit the target score and completed the run.' : 'You ran out of lives before reaching the target.' }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.container-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background:
    radial-gradient(circle at top, rgba(231, 169, 76, 0.18), transparent 35%),
    linear-gradient(135deg, rgba(16, 24, 39, 0.96), rgba(31, 41, 55, 0.92));
}

.imdb-guessr {
  margin: 0;
  padding: var(--spacing-xl);
  position: relative;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.loading,
.error {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  font-size: 1.3rem;
}

.hud {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.hud-card,
.goal-panel {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.hud-card {
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hud-label {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.goal-panel {
  padding: 1rem 1.2rem;
}

.goal-copy {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.premiere-badge {
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  color: white;
  font-weight: 700;
}

.progress-bar {
  height: 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #f59e0b);
  transition: width 180ms ease;
}

.meta-line,
.milestone-message {
  margin: 0.75rem 0 0;
  color: var(--text-secondary);
}

.milestone-message {
  color: #fbbf24;
}

.game-container {
  background-color: rgba(15, 23, 42, 0.88);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  flex: 1;
  display: flex;
  gap: var(--spacing-xl);
  min-height: 500px;
}

.movie-poster {
  flex: 0 0 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 100%;
  overflow: hidden;
}

.movie-poster img {
  width: 100%;
  max-height: 100%;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  object-fit: contain;
  background: rgba(255, 255, 255, 0.04);
}

.content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  overflow-y: auto;
  padding-right: var(--spacing-sm);
  min-width: 0;
}

.movie-clues p {
  margin-bottom: var(--spacing-sm);
  line-height: 1.55;
  overflow-wrap: break-word;
}

.guess-section {
  background-color: rgba(255, 255, 255, 0.05);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  text-align: center;
  flex: 1;
}

.guess-input,
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

input[type='range'] {
  width: 100%;
  max-width: 400px;
}

.guess-value {
  font-size: 2rem;
  font-weight: bold;
  color: #fbbf24;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #f59e0b, #dc2626);
  transition:
    transform var(--transition-speed),
    filter var(--transition-speed);
}

button:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

button:disabled {
  background: var(--disabled-color);
  cursor: not-allowed;
  transform: none;
  filter: none;
}

.feedback {
  font-size: 1.1rem;
  color: #fbbf24;
}

.actual-rating,
.your-guess,
.round-summary {
  font-size: 1.05rem;
}

.restart-button {
  background: linear-gradient(135deg, #10b981, #0f766e);
}

.run-finish-banner {
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  color: white;
}

.run-finish-banner h2,
.run-finish-banner p {
  margin: 0;
}

.run-finish-banner h2 {
  margin-bottom: 0.35rem;
}

.run-finish-banner.victory {
  background: rgba(22, 163, 74, 0.24);
  border: 1px solid rgba(34, 197, 94, 0.45);
}

.run-finish-banner.defeat {
  background: rgba(185, 28, 28, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.45);
}

@media (max-width: 1100px) {
  .hud {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .imdb-guessr {
    width: 100% !important;
    height: 100% !important;
    padding: var(--spacing-md);
  }

  .hud {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .game-container {
    flex-direction: column;
    padding: var(--spacing-lg);
    min-height: auto;
  }

  .movie-poster {
    flex: none;
    width: 100%;
    max-width: 280px;
    margin: 0 auto;
  }
}
</style>
