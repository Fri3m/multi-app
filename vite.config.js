import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { getSteamGameStats, getSteamGames } from './server/steamApi.js'

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function steamApiDevPlugin() {
  return {
    name: 'steam-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url ? new URL(request.url, 'http://localhost') : null
        if (!requestUrl) {
          next()
          return
        }

        if (requestUrl.pathname === '/api/steam-games') {
          try {
            const games = await getSteamGames()
            sendJson(response, 200, games)
          } catch (error) {
            sendJson(response, 502, { error: error.message })
          }
          return
        }

        if (requestUrl.pathname === '/api/steam-game') {
          const appid = requestUrl.searchParams.get('appid')?.trim()
          if (!appid || !/^\d+$/.test(appid)) {
            sendJson(response, 400, { error: 'A numeric appid query parameter is required.' })
            return
          }

          try {
            const stats = await getSteamGameStats(appid)
            sendJson(response, 200, stats)
          } catch (error) {
            sendJson(response, 502, { error: error.message })
          }
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    steamApiDevPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
