<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'

const movies = ref([])
const currentMovie = ref(null)
const userGuess = ref(null)
const guessSubmitted = ref(false)
const feedback = ref('')
const score = ref(0)
const loading = ref(true)
const error = ref(null)

// Reactive refs for container sizing
const windowHeight = ref(window.innerHeight)
const windowWidth = ref(window.innerWidth)

// Update window dimensions on resize
onMounted(() => {
  window.addEventListener('resize', () => {
    windowHeight.value = window.innerHeight
    windowWidth.value = window.innerWidth
  })
})

// Load movies on component mount
onMounted(async () => {
  try {
    loading.value = true
    movies.value = await api.getMovies()
    selectRandomMovie()
  } catch (err) {
    error.value = 'Failed to load movies: ' + err.message
  } finally {
    loading.value = false
  }
})

function selectRandomMovie() {
  if (movies.value.length === 0) return

  const randomIndex = Math.floor(Math.random() * movies.value.length)
  console.log(movies.value[randomIndex])
  currentMovie.value = movies.value[randomIndex]
  userGuess.value = null
  guessSubmitted.value = false
  feedback.value = ''
}

function submitGuess() {
  if (userGuess.value === null) return

  guessSubmitted.value = true
  const actualRating = parseFloat(currentMovie.value.rating)
  const difference = Math.abs(userGuess.value - actualRating)

  // Calculate points based on how close the guess is
  let points = 0
  if (difference < 0.1) points = 10
  else if (difference < 0.3) points = 8
  else if (difference < 0.5) points = 6
  else if (difference < 1.0) points = 4
  else if (difference < 1.5) points = 2
  else points = 0

  score.value += points

  if (difference < 0.5) {
    feedback.value = `Great guess! You were only ${difference.toFixed(1)} off. +${points} points!`
  } else if (difference < 1.0) {
    feedback.value = `Good guess! You were ${difference.toFixed(1)} off. +${points} points!`
  } else {
    feedback.value = `You were ${difference.toFixed(1)} off. +${points} points!`
  }
}

function nextMovie() {
  selectRandomMovie()
}

// Computed properties for movie clues
const movieClues = computed(() => {
  if (!currentMovie.value) return {}

  return {
    year: currentMovie.value.year,
    director: currentMovie.value.director,
    plot: currentMovie.value.plot,
  }
})
</script>

<template>
  <div class="container-wrapper">
    <div
      class="imdb-guessr"
      :style="{
        height: windowHeight * 0.8 + 'px',
        width: windowWidth * 0.8 + 'px',
      }"
    >
      <!-- Removed h1 title -->

      <div v-if="loading" class="loading">Loading movies...</div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <div v-else-if="currentMovie" class="game-container">
        <div class="movie-info">
          <div class="movie-poster">
            <img :src="currentMovie.poster_link" :alt="currentMovie.title" />
          </div>

          <div class="movie-clues">
            <h2>{{ currentMovie.title }}</h2>
            <p><strong>Year:</strong> {{ movieClues.year }}</p>
            <p><strong>Director:</strong> {{ movieClues.director }}</p>
            <p><strong>Plot:</strong> {{ movieClues.plot }}</p>
          </div>
        </div>

        <div class="guess-section">
          <h3>Guess the IMDB Rating (1-10)</h3>

          <div v-if="!guessSubmitted" class="guess-input">
            <input type="range" v-model.number="userGuess" min="1" max="10" step="0.1" />
            <div class="guess-value">{{ userGuess ? userGuess.toFixed(1) : '?' }}</div>
            <button @click="submitGuess" :disabled="userGuess === null">Submit Guess</button>
          </div>

          <div v-else class="result">
            <p class="feedback">{{ feedback }}</p>
            <p class="actual-rating">
              Actual rating: <strong>{{ parseFloat(currentMovie.rating).toFixed(1) }}</strong>
            </p>
            <p class="your-guess">
              Your guess: <strong>{{ userGuess.toFixed(1) }}</strong>
            </p>
            <button @click="nextMovie" class="next-button">Next Movie</button>
          </div>
        </div>
      </div>

      <!-- Moved score to bottom left -->
      <div class="score-container">
        <p class="score">Score: {{ score }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.imdb-guessr {
  margin: 0;
  padding: var(--spacing-xl);
  position: relative;
  overflow: hidden; /* Prevent scrolling */
  display: flex;
  flex-direction: column;
}

.score-container {
  position: absolute;
  bottom: var(--spacing-md);
  left: var(--spacing-md);
}

.score {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0;
}

.game-container {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  overflow: auto; /* Allow scrolling inside container if needed */
  flex: 1;
}

.movie-info {
  display: flex;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.movie-poster {
  flex: 0 0 200px;
}

.movie-poster img {
  width: 100%;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

.movie-clues {
  flex: 1;
}

.movie-clues h2 {
  margin-bottom: var(--spacing-md);
  color: var(--text-primary);
}

.movie-clues p {
  margin-bottom: var(--spacing-sm);
  line-height: 1.5;
}

.guess-section {
  background-color: var(--bg-card-secondary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  text-align: center;
}

.guess-section h3 {
  margin-bottom: var(--spacing-lg);
}

.guess-input {
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
  color: var(--color-primary);
}

button {
  padding: 0.75rem 1.5rem;
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  transition: background-color var(--transition-speed);
}

button:hover {
  background-color: var(--color-primary-dark);
}

button:disabled {
  background-color: var(--disabled-color);
  cursor: not-allowed;
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.feedback {
  font-size: 1.2rem;
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}

.actual-rating,
.your-guess {
  font-size: 1.1rem;
}

.next-button {
  margin-top: var(--spacing-md);
}

@media (max-width: 768px) {
  .movie-info {
    flex-direction: column;
    align-items: center;
  }

  .movie-poster {
    flex: 0 0 auto;
    margin-bottom: var(--spacing-lg);
  }
}
</style>
