<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../services/api'
const REVEAL_DURATION_MS = 1100

const allGames = ref([])
const currentGame = ref(null)
const nextGame = ref(null)
const loading = ref(true)
const error = ref(null)
const score = ref(0)
const highScore = ref(0)
const gameOver = ref(false)
const comparisonMetric = ref('rating')
const revealState = ref('idle')
const revealMessage = ref('')
let revealTimeoutId = null

const metrics = {
  rating: {
    label: 'Rating',
    property: 'rating',
    formatter: (value) => `${Number(value ?? 0).toFixed(1)}%`,
  },
}

const currentMetricLabel = computed(() => metrics[comparisonMetric.value].label)
const shouldRevealNextValue = computed(() => revealState.value !== 'idle' || gameOver.value)

onMounted(async () => {
  try {
    loading.value = true

    const savedHighScore = localStorage.getItem('steam-higher-lower-highscore')
    if (savedHighScore) {
      highScore.value = parseInt(savedHighScore, 10)
    }

    allGames.value = await api.getAllGames()
    startNewGame()
  } catch (err) {
    error.value = `Failed to load games: ${err.message}`
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  clearRevealTimeout()
})

function normalizeGame(game) {
  return {
    ...game,
    image_url: game.library_image || game.image_url,
  }
}

function getRandomIndices(max, count) {
  const indices = []

  while (indices.length < count) {
    const randomIndex = Math.floor(Math.random() * max)
    if (!indices.includes(randomIndex)) {
      indices.push(randomIndex)
    }
  }

  return indices
}

function startNewGame() {
  if (allGames.value.length < 2) return

  clearRevealTimeout()
  score.value = 0
  gameOver.value = false
  revealState.value = 'idle'
  revealMessage.value = ''

  const randomIndices = getRandomIndices(allGames.value.length, 2)
  currentGame.value = normalizeGame(allGames.value[randomIndices[0]])
  nextGame.value = normalizeGame(allGames.value[randomIndices[1]])
}

function getMetricValue(game) {
  const metric = metrics[comparisonMetric.value]
  return Number(game?.[metric.property] ?? 0)
}

function getFormattedMetricValue(game) {
  const metric = metrics[comparisonMetric.value]
  return metric.formatter(getMetricValue(game))
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US')
}

function getNextGame() {
  const availableGames = allGames.value.filter((game) => game.appid !== currentGame.value.appid)
  const randomIndex = Math.floor(Math.random() * availableGames.length)
  return normalizeGame(availableGames[randomIndex])
}

function advanceRound() {
  currentGame.value = nextGame.value
  nextGame.value = getNextGame()
  revealState.value = 'idle'
  revealMessage.value = ''
}

function clearRevealTimeout() {
  if (revealTimeoutId !== null) {
    window.clearTimeout(revealTimeoutId)
    revealTimeoutId = null
  }
}

function scheduleRevealTransition(callback) {
  clearRevealTimeout()
  revealTimeoutId = window.setTimeout(() => {
    callback()
    revealTimeoutId = null
  }, REVEAL_DURATION_MS)
}

function makeGuess(isHigher) {
  if (gameOver.value || !currentGame.value || !nextGame.value || revealState.value !== 'idle') return

  const currentValue = getMetricValue(currentGame.value)
  const nextValue = getMetricValue(nextGame.value)

  const correct =
    (isHigher && nextValue > currentValue) ||
    (!isHigher && nextValue < currentValue) ||
    nextValue === currentValue

  if (correct) {
    revealState.value = 'correct'
    revealMessage.value = `${nextGame.value.name} was the right call.`
    score.value += 1

    if (score.value > highScore.value) {
      highScore.value = score.value
      localStorage.setItem('steam-higher-lower-highscore', highScore.value.toString())
    }

    scheduleRevealTransition(() => {
      if (!gameOver.value) {
        advanceRound()
      }
    })
    return
  }

  revealState.value = 'wrong'
  revealMessage.value = `${nextGame.value.name} went the other way.`
  scheduleRevealTransition(() => {
    gameOver.value = true
  })
}
</script>

<template>
  <div class="higher-lower-game">
    <div class="page-shell">
      <header class="hero">
        <h1>STEAM HIGHER LOWER</h1>
      </header>

      <div v-if="loading" class="loading">Loading games...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else-if="currentGame && nextGame" class="game-container">
        <div class="top-bar">
          <div class="score-display">
            <div class="score-chip">
              <span class="score-label">Score</span>
              <strong>{{ score }}</strong>
            </div>
            <div class="score-chip">
              <span class="score-label">Best</span>
              <strong>{{ highScore }}</strong>
            </div>
          </div>
        </div>

        <div class="game-area" :class="{ 'game-over': gameOver }">
          <div class="game-stage">
            <div class="game-cards">
              <div class="game-card current-card">
                <div class="game-image-container">
                  <img :src="currentGame.image_url" :alt="currentGame.name" class="game-image" />
                  <div class="game-overlay">
                    <div class="metric-pill">{{ currentMetricLabel }}</div>
                    <h2 class="game-title">{{ currentGame.name }}</h2>
                    <div class="review-count">{{ formatNumber(currentGame.total_reviews) }} reviews</div>
                    <div class="game-stat">
                      <span class="stat-label">has {{ currentMetricLabel }}</span>
                      <span class="stat-value">{{ getFormattedMetricValue(currentGame) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="game-card next-card">
                <div class="game-image-container">
                  <img :src="nextGame.image_url" :alt="nextGame.name" class="game-image" />
                  <div class="game-overlay">
                    <div class="metric-pill">{{ currentMetricLabel }}</div>
                    <h2 class="game-title">{{ nextGame.name }}</h2>
                    <div class="review-count">{{ formatNumber(nextGame.total_reviews) }} reviews</div>
                    <div class="game-stat">
                      <span class="stat-label">has {{ currentMetricLabel }}</span>
                      <transition name="stat-reveal" mode="out-in">
                        <span
                          v-if="shouldRevealNextValue"
                          key="revealed"
                          class="stat-value"
                          :class="{ 'is-correct': revealState === 'correct', 'is-wrong': revealState === 'wrong' }"
                        >
                          {{ getFormattedMetricValue(nextGame) }}
                        </span>
                        <span v-else key="hidden" class="stat-question">?</span>
                      </transition>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="vs-indicator">VS</div>
          </div>

          <div v-if="!gameOver" class="game-actions">
            <div class="comparison-prompt">
              <span>{{ nextGame.name }} has</span>
              <div class="choice-buttons">
                <button @click="makeGuess(false)" class="choice-button lower-button">Lower</button>
                <span class="or-label">or</span>
                <button @click="makeGuess(true)" class="choice-button higher-button">Higher</button>
              </div>
              <span>{{ currentMetricLabel }} than {{ currentGame.name }}</span>
            </div>

            <transition name="result-pop">
              <p v-if="revealState !== 'idle'" class="reveal-banner" :class="revealState">
                {{ revealMessage }}
              </p>
            </transition>
          </div>

          <div v-else class="game-over-screen">
            <p class="death-subtitle">Ashes remain. The run is over.</p>
            <h2 class="death-title">YOU DIED</h2>
            <p class="death-score">Score: {{ score }}</p>
            <p class="death-best">Best Score: {{ highScore }}</p>
            <button @click="startNewGame" class="play-again-button">Play Again</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.higher-lower-game {
  width: 100vw;
  min-height: 100vh;
  margin-left: calc(50% - 50vw);
  background:
    radial-gradient(circle at top, rgba(107, 173, 255, 0.14), transparent 28%),
    linear-gradient(180deg, #0b1220 0%, #101827 52%, #0e1624 100%);
  color: #f2f5fb;
  padding: 0.9rem 0.9rem 1.2rem;
  overflow-x: hidden;
}

.page-shell {
  width: 100%;
  max-width: none;
  margin: 0 auto;
}

.hero {
  text-align: center;
  margin-bottom: 0.65rem;
}

h1 {
  margin: 0;
  color: #8cb9e3;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.loading,
.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 1.5rem;
}

.error {
  color: var(--color-danger-light);
}

.game-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  position: relative;
  min-height: calc(100vh - 70px);
}

.top-bar {
  position: absolute;
  top: 0.1rem;
  right: 0.1rem;
  z-index: 30;
}

.score-display {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.score-chip {
  min-width: 92px;
  padding: 0.45rem 0.7rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
}

.score-label {
  display: block;
  margin-bottom: 0.1rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(242, 245, 251, 0.66);
}

.score-chip strong {
  font-size: 1.1rem;
}

.game-area {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.65rem;
  min-height: 0;
}

.game-stage {
  position: relative;
  min-height: 0;
}

.game-cards {
  display: flex;
  width: 100%;
  height: min(calc(100vh - 235px), 760px);
  gap: 0.9rem;
}

.game-card {
  flex: 1;
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
  background: #111a29;
}

.game-image-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.game-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  filter: brightness(0.72) saturate(1.04);
  transform: scale(1.02);
}

.game-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 2rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(7, 12, 21, 0.88) 78%);
}

.metric-pill {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 0.9rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.game-title {
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  margin: 0 0 0.55rem;
  line-height: 0.95;
  text-wrap: balance;
}

.review-count {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: rgba(242, 245, 251, 0.72);
}

.game-stat {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: fit-content;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(8, 14, 24, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-label {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(242, 245, 251, 0.66);
}

.stat-value {
  font-size: clamp(2.2rem, 4vw, 3.2rem);
  font-weight: bold;
  color: var(--color-warning);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.stat-value.is-correct {
  color: var(--color-success);
}

.stat-value.is-wrong {
  color: var(--color-danger-light);
}

.stat-question {
  font-size: 4.1rem;
  font-weight: bold;
  color: var(--color-warning);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.vs-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(222, 233, 250, 0.92));
  color: #0e1624;
  font-size: 1.35rem;
  font-weight: bold;
  border-radius: 999px;
  width: 4.5rem;
  height: 4.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.game-actions {
  width: min(86%, 860px);
  margin: 0 auto;
  text-align: center;
  z-index: 15;
  display: grid;
  gap: 0.55rem;
}

.comparison-prompt,
.reveal-banner {
  background-color: rgba(10, 16, 26, 0.56);
  padding: 0.9rem 1.1rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
}

.comparison-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.96rem;
  line-height: 1.35;
}

.reveal-banner {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.reveal-banner.correct {
  color: #92f2c5;
}

.reveal-banner.wrong {
  color: #ffb0b0;
}

.choice-buttons {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.or-label {
  color: rgba(242, 245, 251, 0.72);
}

.choice-button,
.play-again-button {
  padding: 0.72rem 1.45rem;
  border: none;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
  transition:
    transform var(--transition-speed),
    filter var(--transition-speed),
    box-shadow var(--transition-speed);
}

.choice-button:hover,
.play-again-button:hover {
  transform: translateY(-2px);
  filter: brightness(1.03);
}

.higher-button {
  background: linear-gradient(180deg, #78ddb9, #46c896);
  color: white;
  box-shadow: 0 14px 30px rgba(70, 200, 150, 0.24);
}

.lower-button {
  background: linear-gradient(180deg, #ff8d7d, #e86452);
  color: white;
  box-shadow: 0 14px 30px rgba(232, 100, 82, 0.24);
}

.game-over-screen {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at center, rgba(123, 28, 18, 0.18), rgba(0, 0, 0, 0.94) 42%),
    rgba(0, 0, 0, 0.94);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 20;
  gap: 0.65rem;
  text-align: center;
}

.stat-reveal-enter-active,
.stat-reveal-leave-active,
.result-pop-enter-active,
.result-pop-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.stat-reveal-enter-from,
.result-pop-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.stat-reveal-leave-to,
.result-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@keyframes deathPulse {
  0%,
  100% {
    opacity: 0.86;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.03);
  }
}

.death-subtitle {
  margin: 0;
  color: rgba(255, 227, 212, 0.68);
  font-size: 0.82rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.death-title {
  margin: 0;
  font-size: clamp(3.1rem, 8vw, 6.4rem);
  color: #cf4d36;
  letter-spacing: 0.22em;
  text-shadow:
    0 0 10px rgba(207, 77, 54, 0.46),
    0 0 34px rgba(207, 77, 54, 0.24);
  animation: deathPulse 2200ms ease-in-out infinite;
}

.death-score,
.death-best {
  margin: 0;
  font-size: 1.1rem;
  color: rgba(255, 244, 236, 0.84);
}

.play-again-button {
  background: linear-gradient(180deg, #7aaef3, #4f89dd);
  color: white;
  margin-top: 0.6rem;
  box-shadow: 0 14px 30px rgba(79, 137, 221, 0.24);
}

.game-over .game-card.next-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

@media (max-width: 768px) {
  .higher-lower-game {
    padding-inline: 0.65rem;
  }

  .hero {
    margin-bottom: 0.45rem;
  }

  .game-cards {
    flex-direction: column;
    height: min(calc(100vh - 250px), 640px);
  }

  .game-card {
    height: auto;
    min-height: 0;
  }

  .vs-indicator {
    top: 50%;
    width: 3rem;
    height: 3rem;
    font-size: 1.2rem;
  }

  .game-actions {
    width: 100%;
  }

  .comparison-prompt,
  .reveal-banner {
    padding: 1rem;
  }

  .choice-buttons {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    width: 100%;
  }

  .score-display {
    gap: 0.5rem;
  }

  .score-chip {
    min-width: 0;
    flex: none;
  }

  .game-overlay {
    padding: 1rem;
  }

  .game-title {
    font-size: 1.4rem;
  }

  .review-count,
  .stat-label {
    font-size: 0.95rem;
  }

  .stat-value {
    font-size: 2rem;
  }

  .stat-question {
    font-size: 3rem;
  }
}
</style>
