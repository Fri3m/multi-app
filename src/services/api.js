// Base API service for the multi-app platform

// Mock data for development
const mockGames = [
  {
    "name": "PUBG: BATTLEGROUNDS",
    "appid": "578080",
    "total_reviews": 276279,
    "rating": 63.12,
    "image_url": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg",
    "library_image": "https://cdn.akamai.steamstatic.com/steam/apps/578080/library_600x900.jpg",
    "max_players": "3257248"
  },
  {
    "name": "Black Myth: Wukong",
    "appid": "2358720",
    "total_reviews": 59063,
    "rating": 94.18,
    "image_url": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg",
    "library_image": "https://cdn.akamai.steamstatic.com/steam/apps/2358720/library_600x900.jpg",
    "max_players": "2415714"
  }
];

// Mock videos data
const mockVideos = [
  {"id": "nBMtB2L3UjI", "url": "https://www.youtube.com/watch?v=nBMtB2L3UjI", "platform": "youtube"},
  {"id": "NDsO1LT_0lw", "url": "https://www.youtube.com/watch?v=NDsO1LT_0lw", "platform": "youtube"}
];

export default {
  // Steam Game Comparison methods
  async getAllGames() {
    try {
      const response = await fetch('/all_games.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching games:', error);
      // Return mock data as fallback
      return [
        {
          "name": "PUBG: BATTLEGROUNDS",
          "appid": "578080",
          "total_reviews": 276279,
          "rating": 63.12,
          "image_url": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg",
          "library_image": "https://cdn.akamai.steamstatic.com/steam/apps/578080/library_600x900.jpg",
          "max_players": "3257248"
        },
        {
          "name": "Black Myth: Wukong",
          "appid": "2358720",
          "total_reviews": 59063,
          "rating": 94.18,
          "image_url": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg",
          "library_image": "https://cdn.akamai.steamstatic.com/steam/apps/2358720/library_600x900.jpg",
          "max_players": "2415714"
        }
      ];
    }
  },
  
  // IMDB Guessr methods
  async getMovies() {
    try {
      const response = await fetch('/all_movies.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching movies:', error);
      // Return mock data as fallback
      return [
        {
          id: 1,
          title: "The Shawshank Redemption",
          year: 1994,
          director: "Frank Darabont",
          actors: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
          plot: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
          poster: "https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_.jpg",
          rating: 9.3
        }
      ];
    }
  },
  
  // Video Watcher methods
  async getVideos() {
    try {
      const response = await fetch('/videos.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching videos:', error);
      // Return mock data as fallback
      return [
        {"id": "nBMtB2L3UjI", "url": "https://www.youtube.com/watch?v=nBMtB2L3UjI", "platform": "youtube"},
        {"id": "NDsO1LT_0lw", "url": "https://www.youtube.com/watch?v=NDsO1LT_0lw", "platform": "youtube"}
      ];
    }
  },
  
  async addVideo(videoData) {
    // In a real app, this would post to an API
    console.log('Adding video:', videoData);
    return { success: true };
  }
}; 