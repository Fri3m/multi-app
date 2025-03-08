import { createRouter, createWebHistory } from 'vue-router'
import MainMenuView from '../views/MainMenuView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MainMenuView,
    },
    {
      path: '/video-watcher',
      name: 'video-watcher',
      component: () => import('../views/VideoWatcherView.vue'),
    },
    {
      path: '/imdb-guessr',
      name: 'imdb-guessr',
      component: () => import('../views/ImdbGuessrView.vue'),
    },
    {
      path: '/steam-game-comparison',
      name: 'steam-game-comparison',
      component: () => import('../views/SteamGameComparisonView.vue'),
    },
  ],
})

export default router
