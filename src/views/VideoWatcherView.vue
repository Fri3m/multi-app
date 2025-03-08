<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api'

const videos = ref([])
const newVideoUrl = ref('')
const loading = ref(true)
const error = ref(null)

// Load videos on component mount
onMounted(async () => {
  try {
    loading.value = true
    videos.value = await api.getVideos()
  } catch (err) {
    error.value = 'Failed to load videos: ' + err.message
  } finally {
    loading.value = false
  }
})

// Computed property for grid layout class
const gridClass = computed(() => {
  const count = videos.value.length
  if (count <= 0) return 'videos-0'
  if (count === 1) return 'videos-1'
  if (count === 2) return 'videos-2'
  if (count === 3) return 'videos-3'
  if (count === 4) return 'videos-4'
  if (count <= 6) return 'videos-6'
  return 'videos-9'
})

// Extract video ID from URL
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

// Add a new video
async function addVideo() {
  if (!newVideoUrl.value) return
  
  const videoId = extractVideoId(newVideoUrl.value)
  if (!videoId) {
    error.value = 'Invalid YouTube URL'
    return
  }
  
  try {
    const videoData = {
      id: videoId,
      url: newVideoUrl.value,
      platform: 'youtube'
    }
    
    await api.addVideo(videoData)
    videos.value.push(videoData)
    newVideoUrl.value = ''
    error.value = null
  } catch (err) {
    error.value = 'Failed to add video: ' + err.message
  }
}

// Remove a video
function removeVideo(index) {
  videos.value.splice(index, 1)
}
</script>

<template>
  <div class="video-watcher">
    <div class="controls">
      <h1>Video Watcher</h1>
      
      <div class="add-video-form">
        <input 
          type="text" 
          v-model="newVideoUrl" 
          placeholder="Enter YouTube URL" 
          @keyup.enter="addVideo"
        />
        <button @click="addVideo">Add Video</button>
      </div>
      
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
    
    <div v-if="loading" class="loading">Loading videos...</div>
    
    <div v-else-if="videos.length === 0" class="empty-state">
      <p>No videos added yet. Add a YouTube URL to get started.</p>
    </div>
    
    <div v-else :class="['video-grid', gridClass]">
      <div 
        v-for="(video, index) in videos" 
        :key="video.id + index" 
        class="video-container"
      >
        <div class="remove-panel">
          <button class="remove-btn" @click="removeVideo(index)">×</button>
        </div>
        
        <iframe 
          :src="`https://www.youtube.com/embed/${video.id}`" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-watcher {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.controls {
  margin-bottom: 1rem;
}

h1 {
  margin-bottom: 1rem;
  text-align: center;
}

.add-video-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  max-width: 600px;
  margin: 0 auto 1rem auto;
}

input {
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #444;
  background-color: #222;
  color: white;
}

button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

.error-message {
  color: #ff6b6b;
  text-align: center;
  margin-bottom: 1rem;
}

.loading, .empty-state {
  text-align: center;
  margin-top: 2rem;
}

/* Video grid styles */
.video-grid {
  display: grid;
  gap: 1rem;
  flex: 1;
  width: 100%;
}

/* Dynamic grid layouts based on video count */
.video-grid.videos-1 {
  grid-template-columns: 1fr;
}

.video-grid.videos-2 {
  grid-template-columns: repeat(2, 1fr);
}

.video-grid.videos-3 {
  grid-template-columns: repeat(3, 1fr);
}

.video-grid.videos-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.videos-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.videos-9 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  z-index: 1;
}

/* Remove button and panel styles */
.remove-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.remove-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  padding: 0;
}

.remove-btn:hover {
  background-color: rgba(255, 0, 0, 0.7);
}
</style> 