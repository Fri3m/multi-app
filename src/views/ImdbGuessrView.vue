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
    plot: currentMovie.value.plot
  }
})
</script>

<template>
  <div class="imdb-guessr">
    <h1>IMDB Guessr</h1>
    <p class="score">Score: {{ score }}</p>
    
    <div v-if="loading" class="loading">
      Loading movies...
    </div>
    
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
          <input 
            type="range" 
            v-model.number="userGuess" 
            min="1" 
            max="10" 
            step="0.1" 
          />
          <div class="guess-value">{{ userGuess ? userGuess.toFixed(1) : '?' }}</div>
          <button @click="submitGuess" :disabled="userGuess === null">Submit Guess</button>
        </div>
        
        <div v-else class="result">
          <p class="feedback">{{ feedback }}</p>
          <p class="actual-rating">Actual rating: <strong>{{ parseFloat(currentMovie.rating).toFixed(1) }}</strong></p>
          <p class="your-guess">Your guess: <strong>{{ userGuess.toFixed(1) }}</strong></p>
          <button @click="nextMovie" class="next-button">Next Movie</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.imdb-guessr {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  margin-bottom: 1rem;
}

.score {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 2rem;
}

.game-container {
  background-color: #333;
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.movie-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.movie-poster {
  flex: 0 0 200px;
}

.movie-poster img {
  width: 100%;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.movie-clues {
  flex: 1;
}

.movie-clues h2 {
  margin-bottom: 1rem;
  color: #fff;
}

.movie-clues p {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.guess-section {
  background-color: #444;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.guess-section h3 {
  margin-bottom: 1.5rem;
}

.guess-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

input[type="range"] {
  width: 100%;
  max-width: 400px;
}

.guess-value {
  font-size: 2rem;
  font-weight: bold;
  color: #4CAF50;
}

button {
  padding: 0.75rem 1.5rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.feedback {
  font-size: 1.2rem;
  color: #4CAF50;
  margin-bottom: 1rem;
}

.actual-rating, .your-guess {
  font-size: 1.1rem;
}

.next-button {
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .movie-info {
    flex-direction: column;
    align-items: center;
  }
  
  .movie-poster {
    flex: 0 0 auto;
    margin-bottom: 1.5rem;
  }
}
</style> 