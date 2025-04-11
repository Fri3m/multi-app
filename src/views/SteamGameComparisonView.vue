<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api'

const allGames = ref([])
const currentGame = ref(null)
const nextGame = ref(null)
const loading = ref(true)
const error = ref(null)
const score = ref(0)
const highScore = ref(0)
const gameOver = ref(false)
const comparisonMetric = ref('rating') // Default to rating now
const metrics = {
  peak_players: {
    label: 'Peak Players',
    property: 'max_players',
    formatter: formatNumber
  },
  rating: {
    label: 'Rating %',
    property: 'rating',
    formatter: (val) => val.toFixed(1) + '%'
  }
}

// Load games on component mount
onMounted(async () => {
  try {
    loading.value = true

    // Try to get high score from local storage
    const savedHighScore = localStorage.getItem('steam-higher-lower-highscore')
    if (savedHighScore) {
      highScore.value = parseInt(savedHighScore, 10)
    }

    allGames.value = await api.getAllGames()
    startNewGame()
  } catch (err) {
    error.value = 'Failed to load games: ' + err.message
  } finally {
    loading.value = false
  }
})

// Start a new game
function startNewGame() {
  if (allGames.value.length < 2) return

  score.value = 0
  gameOver.value = false

  // Always use rating as the comparison metric
  comparisonMetric.value = 'rating'

  // Select initial two games
  const randomIndices = getRandomIndices(allGames.value.length, 2)
  currentGame.value = allGames.value[randomIndices[0]]
  nextGame.value = allGames.value[randomIndices[1]]
}

// Get value of the current comparison metric for a game
function getMetricValue(game) {
  const metric = metrics[comparisonMetric.value]
  return +game[metric.property]
}

// Get the current metric's formatted value
function getFormattedMetricValue(game) {
  const metric = metrics[comparisonMetric.value]
  return metric.formatter(getMetricValue(game))
}

// Get current metric's label
const currentMetricLabel = computed(() => {
  return metrics[comparisonMetric.value].label
})

// Format review count for a game
function getFormattedReviewCount(game) {
  return formatNumber(game.total_reviews)
}

// Get n random indices from a range
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

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Player guess - higher or lower
function makeGuess(isHigher) {
  if (gameOver.value) return

  const currentValue = getMetricValue(currentGame.value)
  const nextValue = getMetricValue(nextGame.value)

  let correct = false
  if (isHigher && nextValue > currentValue) {
    correct = true
  } else if (!isHigher && nextValue < currentValue) {
    correct = true
  }

  if (correct) {
    // Player guessed correctly
    score.value++
    if (score.value > highScore.value) {
      highScore.value = score.value
      localStorage.setItem('steam-higher-lower-highscore', highScore.value.toString())
    }

    // Move to next round
    currentGame.value = nextGame.value

    // Get a new next game (that's not the current one)
    const availableGames = allGames.value.filter(g => g.appid !== currentGame.value.appid)
    const randomIndex = Math.floor(Math.random() * availableGames.length)
    nextGame.value = availableGames[randomIndex]

    // Always keep rating as the comparison metric
    comparisonMetric.value = 'rating'
  } else {
    // Player guessed incorrectly - game over
    gameOver.value = true
  }
}
</script>

<template>
  <div class="higher-lower-game">
    <h1>Steam Higher Lower Game</h1>

    <div v-if="loading" class="loading">Loading games...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="currentGame && nextGame" class="game-container">
      <div class="score-display">
        <div class="current-score">Score: {{ score }}</div>
        <div class="high-score">High Score: {{ highScore }}</div>
      </div>

      <div class="game-area" :class="{ 'game-over': gameOver }">
        <div class="game-cards">
          <div class="game-card current-card">
            <div class="game-image-container">
              <img :src="currentGame.image_url" :alt="currentGame.name" class="game-image" />
              <div class="game-overlay">
                <h2 class="game-title">{{ currentGame.name }}</h2>
                <div class="review-count">
                  {{ getFormattedReviewCount(currentGame) }} reviews
                </div>
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
                <h2 class="game-title">{{ nextGame.name }}</h2>
                <div class="review-count">
                  {{ getFormattedReviewCount(nextGame) }} reviews
                </div>
                <div class="game-stat">
                  <span class="stat-label">has {{ currentMetricLabel }}</span>
                  <span v-if="gameOver" class="stat-value">{{ getFormattedMetricValue(nextGame) }}</span>
                  <span v-else class="stat-question">?</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="vs-indicator">VS</div>

        <div v-if="!gameOver" class="game-actions">
          <div class="comparison-prompt">
            <span>{{ nextGame.name }} has</span>
            <div class="choice-buttons">
              <button @click="makeGuess(false)" class="choice-button lower-button">LOWER</button>
              <span>or</span>
              <button @click="makeGuess(true)" class="choice-button higher-button">HIGHER</button>
            </div>
            <span>{{ currentMetricLabel }} than {{ currentGame.name }}</span>
          </div>
        </div>

        <div v-else class="game-over-screen">
          <h2>Game Over!</h2>
          <p>Your score: {{ score }}</p>
          <button @click="startNewGame" class="play-again-button">Play Again</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.higher-lower-game {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--bg-main);
  color: var(--text-primary);
}

h1 {
  text-align: center;
  margin: 1rem 0;
  font-size: 2rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.loading, .error {
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
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
}

.score-display {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  font-weight: bold;
}

.current-score {
  font-size: 1.25rem;
}

.high-score {
  font-size: 1.25rem;
  color: var(--color-warning);
}

.game-area {
  position: relative;
}

.game-cards {
  display: flex;
  width: 100%;
  height: 80vh;
}

.game-card {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: all var(--transition-speed);
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
  filter: brightness(0.7);
}

.game-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 2rem;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0));
}

.game-title {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.review-count {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.game-stat {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.stat-label {
  font-size: 1.2rem;
}

.stat-value {
  font-size: 2.8rem;
  font-weight: bold;
  color: var(--color-warning);
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.stat-question {
  font-size: 4.5rem;
  font-weight: bold;
  color: var(--color-warning);
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.vs-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  padding: 1rem;
  border-radius: var(--radius-full);
  width: 4rem;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  backdrop-filter: blur(10px);
}

.game-actions {
  position: absolute;
  bottom: 4rem;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  text-align: center;
  z-index: 15;
}

.comparison-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  backdrop-filter: blur(2px);
  font-size: 1.2rem;
}

.choice-buttons {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.choice-button {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all var(--transition-speed);
}

.choice-button:hover {
  transform: translateY(-2px);
}

.higher-button {
  background-color: var(--color-success);
  color: white;
}

.higher-button:hover {
  background-color: var(--color-primary-dark);
}

.lower-button {
  background-color: var(--color-danger);
  color: white;
}

.lower-button:hover {
  background-color: var(--color-danger-dark);
}

.game-over-screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 20;
  gap: 2rem;
}

.game-over-screen h2 {
  font-size: 3rem;
  color: var(--color-danger);
}

.game-over-screen p {
  font-size: 1.5rem;
}

.play-again-button {
  padding: 1rem 2rem;
  background-color: var(--color-secondary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all var(--transition-speed);
}

.play-again-button:hover {
  background-color: var(--color-secondary-dark);
  transform: scale(1.05);
}

.game-over .game-card.next-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

/* Standard mobile styles */
@media (max-width: 768px) {
  .game-cards {
    flex-direction: column;
    height: auto;
  }

  .game-card {
    height: 45vh;
  }

  .vs-indicator {
    top: 45vh;
    width: 3rem;
    height: 3rem;
    font-size: 1.2rem;
  }

  .game-actions {
    bottom: 1.5rem;
    width: 90%;
  }

  .comparison-prompt {
    font-size: 0.9rem;
    padding: 1rem;
  }

  .choice-button {
    padding: 0.5rem 1.2rem;
    font-size: 0.9rem;
  }

  .game-overlay {
    padding: 1rem;
  }

  .game-title {
    font-size: 1.4rem;
  }

  .review-count {
    font-size: 0.9rem;
  }

  .stat-label {
    font-size: 1rem;
  }

  .stat-value {
    font-size: 2rem;
  }

  .stat-question {
    font-size: 3rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .score-display {
    padding: 0.5rem;
  }

  .current-score, .high-score {
    font-size: 1rem;
  }
}

/* Extra small screens */
@media (max-width: 480px) {
  .game-card {
    height: 40vh;
  }

  .vs-indicator {
    top: 40vh;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .comparison-prompt {
    padding: 0.75rem;
  }

  .choice-buttons {
    gap: 0.5rem;
  }

  .choice-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}

/* Landscape mode */
@media (max-width: 768px) and (orientation: landscape) {
  .game-cards {
    flex-direction: row;
    height: 80vh;
  }

  .game-card {
    height: auto;
  }

  .vs-indicator {
    top: 50%;
  }

  .game-overlay {
    padding: 0.75rem;
  }

  .game-title {
    font-size: 1.2rem;
    margin-bottom: 0.2rem;
  }

  .review-count {
    margin-bottom: 0.2rem;
  }

  .stat-label {
    font-size: 0.9rem;
  }

  .stat-value {
    font-size: 1.8rem;
  }

  .stat-question {
    font-size: 2.5rem;
  }
}

/* Portrait mode styles - for screens with width ≤ height */
@media (orientation: portrait) {
  .game-area {
    display: flex;
    flex-direction: column;
  }

  .game-cards {
    flex-direction: column;
    height: auto;
    position: relative;
    width: 100%;
  }

  .game-card {
    height: 42vh;
  }

  .vs-indicator {
    top: 42vh;
  }

  /* Remove the game-actions from the absolute position flow */
  .game-actions {
    position: relative;
    bottom: auto;
    left: auto;
    transform: none;
    width: 100%;
    margin-top: 1rem;
    z-index: 10;
  }

  /* Make sure the comparison prompt doesn't overflow on small screens */
  .comparison-prompt {
    padding: 0.75rem;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .game-over-screen {
    position: fixed;
    z-index: 100;
  }
}

/* Very tall portrait screens */
@media (orientation: portrait) and (max-aspect-ratio: 0.6) {
  .game-card {
    height: 38vh;
  }

  .vs-indicator {
    top: 38vh;
  }

  .game-actions {
    margin-top: 1.5rem;
  }
}
</style>
