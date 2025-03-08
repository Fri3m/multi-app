<script setup>
// Main menu component for the multi-app platform
</script>

<template>
  <div class="menu-container">
    <h1>Application Menu</h1>
    <div class="app-grid">
      <router-link :to="{ name: 'video-watcher' }" class="app-card">
        <div class="app-icon">📺</div>
        <h2>Video Watcher</h2>
        <p>Watch multiple streams and videos simultaneously</p>
      </router-link>

      <router-link :to="{ name: 'imdb-guessr' }" class="app-card">
        <div class="app-icon">🎬</div>
        <h2>IMDB Guessr</h2>
        <p>Guess the movie based on the clues provided.</p>
      </router-link>

      <router-link :to="{ name: 'steam-game-comparison' }" class="app-card">
        <div class="app-icon">🎮</div>
        <h2>Steam Game Comparison</h2>
        <p>Compare your favorite Steam games!</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.menu-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.menu-container h1 {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  font-size: 2.5rem;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);
  padding: var(--spacing-md);
}

.app-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  text-align: center;
  text-decoration: none;
  color: var(--text-primary);
  transition:
    transform var(--transition-speed),
    background-color var(--transition-speed);
}

.app-card:hover {
  transform: translateY(-5px);
  background-color: var(--bg-card-secondary);
}

.app-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
}

.app-card h2 {
  margin-bottom: var(--spacing-md);
}

.app-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
