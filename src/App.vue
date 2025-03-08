<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <header v-if="$route.name !== 'home'" class="app-header">
    <router-link to="/" class="home-button">
      <span class="home-icon">🏠</span>
    </router-link>
  </header>

  <div class="app-container">
    <RouterView />
  </div>
</template>

<style>
:root {
  --bg-color: #1a1a1a;
  --text-color: #ffffff;
  --card-bg: #333333;
  --hover-color: #444444;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: Arial, sans-serif;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}

.app-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Home button styles */
.home-button {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: var(--card-bg);
  color: var(--text-color);
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 9999;
  transition: background-color 0.2s, transform 0.2s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.home-button:hover {
  background-color: var(--hover-color);
  transform: translateY(-2px);
}

.home-icon {
  font-size: 1.2rem;
}
</style>
