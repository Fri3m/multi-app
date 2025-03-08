<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import api from '../services/api'

const videos = ref([])
const newVideoUrl = ref('')
const loading = ref(true)
const error = ref(null)
const windowHeight = ref(window.innerHeight)
const windowWidth = ref(window.innerWidth)
const showAddModal = ref(false) // Control visibility of add video modal
const showDeleteConfirmModal = ref(false) // Control visibility of delete confirmation modal
const videoToDeleteIndex = ref(null) // Store index of video to be deleted

// Handle window resize
function handleResize() {
  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
}

// Add and remove event listeners
onMounted(() => {
  loadVideos()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Load videos
async function loadVideos() {
  try {
    loading.value = true
    videos.value = await api.getVideos()
  } catch (err) {
    error.value = 'Failed to load videos: ' + err.message
  } finally {
    loading.value = false
  }
}

// Computed property for grid style based on window size and video count
const gridStyle = computed(() => {
  const controlsHeight = 70 // Reduced height since we removed the form
  const availableHeight = windowHeight.value - controlsHeight

  const count = videos.value.length
  let columns = 1

  if (count === 2) columns = 2
  else if (count >= 3 && count <= 4) columns = 2
  else if (count > 4) columns = 3

  const rows = Math.ceil(count / columns)

  return {
    height: `${availableHeight}px`,
    maxHeight: `${availableHeight}px`,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }
})

// Extract video ID from URL
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

// Add a new video - updated to include a unique identifier
async function addVideo() {
  if (!newVideoUrl.value) return

  const videoId = extractVideoId(newVideoUrl.value)
  if (!videoId) {
    error.value = 'Invalid YouTube URL'
    return
  }

  try {
    // Add a unique identifier for each video instance
    const uniqueId = `${videoId}-${Date.now()}`
    const videoData = {
      id: videoId,
      url: newVideoUrl.value,
      platform: 'youtube',
      uniqueId: uniqueId, // Add a unique identifier to each video
    }

    await api.addVideo(videoData)
    newVideoUrl.value = ''
    error.value = null
    showAddModal.value = false // Close modal after adding

    // Refresh videos list
    videos.value = await api.getVideos()
  } catch (err) {
    error.value = 'Failed to add video: ' + err.message
  }
}

// Trigger the delete confirmation dialog
function confirmDeleteVideo(index) {
  videoToDeleteIndex.value = index
  showDeleteConfirmModal.value = true
}

// Cancel the video deletion
function cancelDeleteVideo() {
  videoToDeleteIndex.value = null
  showDeleteConfirmModal.value = false
}

// Proceed with video deletion after confirmation
async function proceedWithDelete() {
  if (videoToDeleteIndex.value === null) return

  const index = videoToDeleteIndex.value

  try {
    // Get the specific video by its index in the array
    const videoToRemove = videos.value[index]

    // Create a unique identifier for this specific video instance
    // If there's no existing uniqueId, use the index as a fallback
    const uniqueId = videoToRemove.uniqueId || `${videoToRemove.id}-${index}`

    // Call the API with both the video ID and the unique identifier
    const result = await api.removeVideo(videoToRemove.id, uniqueId)

    if (result.success) {
      // If successful, simply remove this video from the local array
      // This ensures only one instance is removed even if there are duplicates
      videos.value.splice(index, 1)
      error.value = null
    } else {
      error.value = result.error || 'Failed to remove video'
    }
  } catch (err) {
    error.value = 'Failed to remove video: ' + err.message
  } finally {
    // Reset delete confirmation state
    videoToDeleteIndex.value = null
    showDeleteConfirmModal.value = false
  }
}

// Toggle add video modal
function toggleAddModal() {
  showAddModal.value = !showAddModal.value
  if (!showAddModal.value) {
    // Clear input and error when closing
    newVideoUrl.value = ''
    error.value = null
  }
}
</script>

<template>
  <div class="video-watcher">
    <div class="controls"></div>

    <div v-if="loading" class="loading">Loading videos...</div>

    <div v-else-if="videos.length === 0" class="empty-state">
      <p>No videos added yet. Click the + button to add a YouTube video.</p>
    </div>

    <div v-else class="video-grid" :style="gridStyle">
      <div
        v-for="(video, index) in videos"
        :key="video.uniqueId || video.id + '-' + index"
        class="video-container"
      >
        <div class="remove-panel">
          <button class="remove-btn" @click="confirmDeleteVideo(index)">×</button>
        </div>

        <iframe
          :src="`https://www.youtube.com/embed/${video.id}?mute=1`"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>

    <!-- Floating Action Button (FAB) -->
    <button class="fab" @click="toggleAddModal">+</button>

    <!-- Add Video Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="toggleAddModal">
      <div class="modal-content">
        <h2>Add YouTube Video</h2>

        <div class="add-video-form">
          <input
            type="text"
            v-model="newVideoUrl"
            placeholder="Enter YouTube URL"
            @keyup.enter="addVideo"
          />
          <div class="modal-buttons">
            <button class="cancel-btn" @click="toggleAddModal">Cancel</button>
            <button class="add-btn" @click="addVideo">Add Video</button>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirmModal" class="modal-overlay">
      <div class="modal-content delete-confirm">
        <h2>Confirm Deletion</h2>
        <p>Are you sure you want to remove this video?</p>
        <div class="modal-buttons">
          <button class="cancel-btn" @click="cancelDeleteVideo">Cancel</button>
          <button class="delete-btn" @click="proceedWithDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-watcher {
  height: 95vh;
  width: 95vw;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  overflow: hidden; /* Prevent scrolling */
  box-sizing: border-box;
  position: relative; /* For FAB positioning */
}

.controls {
  padding: 1rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0; /* Prevent controls from shrinking */
}

h1 {
  margin: 0;
  text-align: center;
}

/* Video grid styles */
.video-grid {
  display: grid;
  gap: 0.5rem;
  width: 100%;
  padding: 0 0.5rem 0.5rem 0.5rem;
  overflow: hidden; /* Prevent grid from scrolling */
  box-sizing: border-box;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0; /* Allow container to shrink below min-height */
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 4px;
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

.error-message {
  color: #ff6b6b;
  text-align: center;
  margin-top: 1rem;
}

.loading,
.empty-state {
  text-align: center;
  margin-top: 2rem;
  flex-grow: 1;
  padding: 0 1rem;
}

/* Floating Action Button */
.fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #4caf50;
  color: white;
  font-size: 30px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.2s ease;
}

.fab:hover {
  background-color: #45a049;
  transform: scale(1.05);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #222;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
}

.add-video-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.add-video-form input {
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #444;
  background-color: #333;
  color: white;
  width: 100%;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.add-btn {
  padding: 0.5rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-btn:hover {
  background-color: #45a049;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background-color: #666;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background-color: #555;
}

/* Delete confirmation specific styles */
.delete-confirm {
  max-width: 400px;
}

.delete-confirm p {
  margin-bottom: 1.5rem;
}

.delete-btn {
  padding: 0.5rem 1rem;
  background-color: #e53935;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn:hover {
  background-color: #c62828;
}
</style>
