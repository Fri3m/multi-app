<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const allGames = ref([])
const game1 = ref(null)
const game2 = ref(null)
const loading = ref(true)
const error = ref(null)

// Load games on component mount
onMounted(async () => {
  try {
    loading.value = true
    allGames.value = await api.getAllGames()

    // Select two random games initially
    selectRandomGames()
  } catch (err) {
    error.value = 'Failed to load games: ' + err.message
  } finally {
    loading.value = false
  }
})

// Select two random games
function selectRandomGames() {
  if (allGames.value.length < 2) return

  const randomIndices = getRandomIndices(allGames.value.length, 2)
  game1.value = allGames.value[randomIndices[0]]
  game2.value = allGames.value[randomIndices[1]]
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

// Change a specific game
function changeGame(gameNumber, gameId) {
  const selectedGame = allGames.value.find((game) => game.appid === gameId)
  if (!selectedGame) return

  if (gameNumber === 1) {
    game1.value = selectedGame
  } else {
    game2.value = selectedGame
  }
}

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Calculate percentage difference
function calculateDifference(val1, val2) {
  const higher = Math.max(val1, val2)
  const lower = Math.min(val1, val2)
  return (((higher - lower) / lower) * 100).toFixed(1)
}
</script>

<template>
  <div class="steam-comparison">
    <h1>Steam Game Comparison</h1>

    <div v-if="loading" class="loading">Loading games...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="game1 && game2" class="comparison-container">
      <div class="game-selectors">
        <div class="game-selector">
          <label for="game1-select">Game 1:</label>
          <select id="game1-select" @change="(e) => changeGame(1, e.target.value)">
            <option
              v-for="game in allGames"
              :key="'g1-' + game.appid"
              :value="game.appid"
              :selected="game.appid === game1.appid"
            >
              {{ game.name }}
            </option>
          </select>
        </div>

        <div class="game-selector">
          <label for="game2-select">Game 2:</label>
          <select id="game2-select" @change="(e) => changeGame(2, e.target.value)">
            <option
              v-for="game in allGames"
              :key="'g2-' + game.appid"
              :value="game.appid"
              :selected="game.appid === game2.appid"
            >
              {{ game.name }}
            </option>
          </select>
        </div>

        <button @click="selectRandomGames" class="random-button">Random Games</button>
      </div>

      <div class="comparison-grid">
        <!-- Headers -->
        <div class="comparison-header"></div>
        <div class="game-header">
          <img :src="game1.image_url" :alt="game1.name" class="game-header-image" />
          <h3>{{ game1.name }}</h3>
        </div>
        <div class="game-header">
          <img :src="game2.image_url" :alt="game2.name" class="game-header-image" />
          <h3>{{ game2.name }}</h3>
        </div>

        <!-- Peak Players -->
        <div class="comparison-label">Peak Players</div>
        <div
          class="comparison-value"
          :class="{ highlight: +game1.max_players > +game2.max_players }"
        >
          {{ formatNumber(game1.max_players) }}
        </div>
        <div
          class="comparison-value"
          :class="{ highlight: +game2.max_players > +game1.max_players }"
        >
          {{ formatNumber(game2.max_players) }}
          <span v-if="+game1.max_players !== +game2.max_players" class="difference">
            {{ +game1.max_players > +game2.max_players ? '↓' : '↑' }}
            {{ calculateDifference(+game1.max_players, +game2.max_players) }}%
          </span>
        </div>

        <!-- Total Reviews -->
        <div class="comparison-label">Total Reviews</div>
        <div
          class="comparison-value"
          :class="{ highlight: game1.total_reviews > game2.total_reviews }"
        >
          {{ formatNumber(game1.total_reviews) }}
        </div>
        <div
          class="comparison-value"
          :class="{ highlight: game2.total_reviews > game1.total_reviews }"
        >
          {{ formatNumber(game2.total_reviews) }}
          <span v-if="game1.total_reviews !== game2.total_reviews" class="difference">
            {{ game1.total_reviews > game2.total_reviews ? '↓' : '↑' }}
            {{ calculateDifference(game1.total_reviews, game2.total_reviews) }}%
          </span>
        </div>

        <!-- Rating -->
        <div class="comparison-label">Rating</div>
        <div class="comparison-value" :class="{ highlight: game1.rating > game2.rating }">
          {{ game1.rating.toFixed(1) }}%
        </div>
        <div class="comparison-value" :class="{ highlight: game2.rating > game1.rating }">
          {{ game2.rating.toFixed(1) }}%
          <span v-if="game1.rating !== game2.rating" class="difference">
            {{ game1.rating > game2.rating ? '↓' : '↑' }}
            {{ Math.abs(game1.rating - game2.rating).toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.steam-comparison {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

h1 {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.loading,
.error {
  text-align: center;
  margin: 3rem 0;
  font-size: 1.2rem;
}

.error {
  color: #ff6b6b;
}

.comparison-container {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
}

.game-selectors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  justify-content: space-between;
  align-items: center;
}

.game-selector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 200px;
}

label {
  font-weight: bold;
}

select {
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  background-color: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.random-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-speed);
  align-self: flex-end;
}

.random-button:hover {
  background-color: var(--color-primary-dark);
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 2fr;
  gap: var(--spacing-md);
  align-items: center;
}

.comparison-header {
  font-weight: bold;
  padding: var(--spacing-sm);
}

.game-header {
  text-align: center;
  padding: var(--spacing-md);
  background-color: var(--bg-card-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

.game-header-image {
  width: 100%;
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
}

.comparison-label {
  font-weight: bold;
  padding: var(--spacing-md);
  background-color: var(--bg-card-secondary);
  border-radius: var(--radius-md);
}

.comparison-value {
  text-align: center;
  padding: var(--spacing-md);
  background-color: var(--bg-card-secondary);
  border-radius: var(--radius-md);
  position: relative;
}

.highlight {
  background-color: var(--color-primary-dark);
  font-weight: bold;
}

.difference {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: var(--spacing-sm);
}

@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'label label'
      'game1 game2'
      'val1 val2';
  }

  .comparison-label {
    grid-area: label;
  }

  .game-header:nth-of-type(2) {
    grid-area: game1;
  }

  .game-header:nth-of-type(3) {
    grid-area: game2;
  }

  .comparison-value:nth-of-type(5) {
    grid-area: val1;
  }

  .comparison-value:nth-of-type(6) {
    grid-area: val2;
  }
}
</style>
