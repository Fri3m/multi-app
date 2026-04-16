# Multi-App Platform

A versatile Vue 3 application that combines multiple interactive web apps in a single platform.

## Live Demo

Visit the live demo: [https://multi-app-1hy.pages.dev](https://multi-app-1hy.pages.dev/)

## Features

This platform includes several standalone applications:

### 📺 Video Watcher
- Watch multiple YouTube videos simultaneously in a grid layout
- Add/remove videos dynamically
- Responsive grid that adjusts based on number of videos and screen size

### 🎬 IMDB Guessr
- Test your movie knowledge by guessing IMDB ratings
- View movie details including year, director, and plot
- Score points based on the accuracy of your guesses

### 🎮 Steam Game Comparison
- Higher-Lower game with Steam games
- Compare games based on user ratings
- Track your score and high score

## Technical Stack

- Vue 3 + Vite
- CSS with custom theming and responsive design
- Local storage for persisting user data

## Project Setup

```sh
npm install
```

### TMDb setup

This project now fetches movie data for the IMDb Guessr screen from TMDb.

1. Create a TMDb account and request an API key or Read Access Token:
   [TMDb Getting Started](https://developer.themoviedb.org/v4/docs/getting-started)
2. Copy `.env.example` to `.env`
3. Add either `VITE_TMDB_READ_ACCESS_TOKEN` or `VITE_TMDB_API_KEY`

TMDb attribution note:
"This product uses the TMDB API but is not endorsed or certified by TMDB."

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
