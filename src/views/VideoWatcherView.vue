<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import api from '../services/api'

const videos = ref([])
const newVideoUrl = ref('')
const newVideoTitle = ref('')
const newVideoNote = ref('')
const loading = ref(true)
const error = ref(null)
const windowHeight = ref(window.innerHeight)
const windowWidth = ref(window.innerWidth)
const layoutMode = ref('auto')
const isMuted = ref(true)
const showAddModal = ref(false)
const showDeleteConfirmModal = ref(false)
const videoToDeleteIndex = ref(null)
const draggedVideoIndex = ref(null)
const dragOverVideoIndex = ref(null)

function handleResize() {
  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  loadVideos()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

async function loadVideos() {
  try {
    loading.value = true
    error.value = null
    videos.value = await api.getVideos()
  } catch (err) {
    error.value = 'Failed to load videos: ' + err.message
  } finally {
    loading.value = false
  }
}

const gridStyle = computed(() => {
  const controlsHeight = 24
  const availableHeight = windowHeight.value - controlsHeight

  const count = videos.value.length
  let columns = 1

  if (layoutMode.value === '1') columns = 1
  else if (layoutMode.value === '2') columns = 2
  else if (layoutMode.value === '3') columns = 3
  else if (count === 2) columns = 2
  else if (count >= 3 && count <= 4) columns = 2
  else if (count > 4) columns = 3

  const rows = Math.ceil(count / columns)

  return {
    height: `${Math.max(availableHeight, 240)}px`,
    maxHeight: `${Math.max(availableHeight, 240)}px`,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }
})

function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

function getDefaultVideoTitle(videoId) {
  return `YouTube Video ${videos.value.length + 1} (${videoId.slice(0, 4)})`
}

function getEmbedUrl(video) {
  const muted = isMuted.value ? '1' : '0'
  return `https://www.youtube.com/embed/${video.id}?mute=${muted}&rel=0`
}

function resetAddForm() {
  newVideoUrl.value = ''
  newVideoTitle.value = ''
  newVideoNote.value = ''
}

async function addVideo() {
  if (!newVideoUrl.value) return

  const videoId = extractVideoId(newVideoUrl.value)
  if (!videoId) {
    error.value = 'Invalid YouTube URL'
    return
  }

  try {
    const uniqueId = `${videoId}-${Date.now()}`
    const videoData = {
      id: videoId,
      url: newVideoUrl.value,
      platform: 'youtube',
      uniqueId,
      title: newVideoTitle.value.trim() || getDefaultVideoTitle(videoId),
      note: newVideoNote.value.trim(),
      addedAt: new Date().toISOString(),
    }

    await api.addVideo(videoData)
    error.value = null
    resetAddForm()
    showAddModal.value = false
    videos.value = await api.getVideos()
  } catch (err) {
    error.value = 'Failed to add video: ' + err.message
  }
}

function confirmDeleteVideo(index) {
  videoToDeleteIndex.value = index
  showDeleteConfirmModal.value = true
}

function cancelDeleteVideo() {
  videoToDeleteIndex.value = null
  showDeleteConfirmModal.value = false
}

async function proceedWithDelete() {
  if (videoToDeleteIndex.value === null) return

  const index = videoToDeleteIndex.value

  try {
    const videoToRemove = videos.value[index]
    const uniqueId = videoToRemove.uniqueId || `${videoToRemove.id}-${index}`
    const result = await api.removeVideo(videoToRemove.id, uniqueId)

    if (result.success) {
      videos.value.splice(index, 1)
      error.value = null
    } else {
      error.value = result.error || 'Failed to remove video'
    }
  } catch (err) {
    error.value = 'Failed to remove video: ' + err.message
  } finally {
    videoToDeleteIndex.value = null
    showDeleteConfirmModal.value = false
  }
}

function toggleAddModal() {
  showAddModal.value = !showAddModal.value
  if (!showAddModal.value) {
    resetAddForm()
    error.value = null
  }
}

async function clearAllVideos() {
  const confirmed = window.confirm('Remove all videos from Video Watcher?')
  if (!confirmed) return

  const result = await api.clearVideos()
  if (result.success) {
    videos.value = []
    error.value = null
    return
  }

  error.value = result.error || 'Failed to clear videos'
}

function openVideo(video) {
  window.open(video.url, '_blank', 'noopener,noreferrer')
}

function handleDragStart(index) {
  draggedVideoIndex.value = index
  dragOverVideoIndex.value = index
}

function handleDragEnd() {
  draggedVideoIndex.value = null
  dragOverVideoIndex.value = null
}

function handleDragEnter(targetIndex) {
  if (draggedVideoIndex.value === null) return
  dragOverVideoIndex.value = targetIndex
}

async function handleDrop(targetIndex) {
  const sourceIndex = draggedVideoIndex.value
  draggedVideoIndex.value = null
  dragOverVideoIndex.value = null

  if (sourceIndex === null || sourceIndex === targetIndex) return
  if (targetIndex < 0 || targetIndex >= videos.value.length) return

  const updatedVideos = [...videos.value]
  const [movedVideo] = updatedVideos.splice(sourceIndex, 1)
  updatedVideos.splice(targetIndex, 0, movedVideo)

  const result = await api.saveVideos(updatedVideos)
  if (result.success) {
    videos.value = result.videos
    error.value = null
    return
  }

  error.value = result.error || 'Failed to reorder videos'
}
</script>

<template>
  <div class="video-watcher">
    <div v-if="loading" class="loading">Loading videos...</div>

    <div v-else-if="videos.length === 0" class="empty-state">
      <p>No videos added yet. Click the + button to build your watch wall.</p>
    </div>

    <div v-else class="video-grid" :style="gridStyle">
      <div
        v-for="(video, index) in videos"
        :key="video.uniqueId || video.id + '-' + index"
        class="video-container"
        :class="{
          dragging: draggedVideoIndex === index,
          'drop-target': dragOverVideoIndex === index && draggedVideoIndex !== index,
        }"
      >
        <div
          class="drag-handle"
          title="Drag to reorder"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragend="handleDragEnd"
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        <button class="remove-btn" @click="confirmDeleteVideo(index)">×</button>

        <button class="video-link" @click="openVideo(video)">
          {{ video.title }}
        </button>

        <iframe
          :src="getEmbedUrl(video)"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>

        <div
          v-if="draggedVideoIndex !== null"
          class="drag-drop-zone"
          @dragenter.prevent="handleDragEnter(index)"
          @dragover.prevent="handleDragEnter(index)"
          @drop="handleDrop(index)"
        ></div>

        <div
          v-if="dragOverVideoIndex === index && draggedVideoIndex !== index"
          class="drop-indicator"
        >
          Drop to move here
        </div>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <button class="fab" @click="toggleAddModal">+</button>

    <div v-if="showAddModal" class="modal-overlay" @click.self="toggleAddModal">
      <div class="modal-content">
        <h2>Add YouTube Video</h2>

        <div class="add-video-form">
          <input
            v-model="newVideoUrl"
            type="text"
            placeholder="Enter YouTube URL"
            @keyup.enter="addVideo"
          />
          <input
            v-model="newVideoTitle"
            type="text"
            placeholder="Custom title (optional)"
            @keyup.enter="addVideo"
          />
          <textarea
            v-model="newVideoNote"
            rows="3"
            placeholder="Short note (optional)"
          ></textarea>

          <div class="modal-buttons">
            <button class="cancel-btn" @click="toggleAddModal">Cancel</button>
            <button class="add-btn" @click="addVideo">Add Video</button>
          </div>
        </div>
      </div>
    </div>

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
  width: min(95vw, 1600px);
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  margin: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

.video-grid {
  display: grid;
  gap: var(--spacing-sm);
  width: 100%;
  height: 100%;
  padding-bottom: var(--spacing-sm);
  overflow: hidden;
  box-sizing: border-box;
}

.video-container {
  position: relative;
  min-height: 0;
  transition:
    transform var(--transition-speed),
    box-shadow var(--transition-speed),
    outline-color var(--transition-speed),
    opacity var(--transition-speed);
}

.video-container.dragging {
  opacity: 0.28;
  transform: scale(0.985);
}

.video-container.drop-target {
  outline: 2px solid rgba(76, 175, 80, 0.9);
  outline-offset: -2px;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.18);
}

.video-container iframe {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: none;
  border-radius: var(--radius-md);
  background-color: #000;
}

.drag-drop-zone {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.drag-handle {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.58);
  cursor: grab;
  z-index: 3;
  opacity: 0.2;
  transition:
    opacity var(--transition-speed),
    background-color var(--transition-speed);
}

.video-container:hover .drag-handle {
  opacity: 1;
}

.video-container.dragging .drag-handle {
  opacity: 1;
  background: rgba(76, 175, 80, 0.35);
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.82);
}

.video-link {
  position: absolute;
  left: 12px;
  bottom: 12px;
  max-width: calc(100% - 24px);
  padding: 0.45rem 0.7rem;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.58);
  color: white;
  font-size: 0.82rem;
  cursor: pointer;
  opacity: 0;
  z-index: 3;
  transition: opacity var(--transition-speed);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-container:hover .video-link {
  opacity: 1;
}

.remove-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  background-color: rgba(0, 0, 0, 0.72);
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-speed);
  padding: 0;
  opacity: 0;
  z-index: 3;
}

.video-container:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background-color: rgba(255, 0, 0, 0.7);
}

.drop-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background:
    linear-gradient(rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.2)),
    rgba(0, 0, 0, 0.15);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 2;
}

.loading,
.empty-state {
  text-align: center;
  margin-top: var(--spacing-xl);
  flex-grow: 1;
  padding: 0 var(--spacing-md);
}

.error-banner {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  background-color: rgba(229, 57, 53, 0.92);
  color: white;
  box-shadow: var(--shadow-lg);
  z-index: 1100;
}

.fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  font-size: 30px;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all var(--transition-speed);
}

.fab:hover {
  background-color: var(--color-primary-dark);
  transform: scale(1.05);
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: var(--spacing-lg);
}

.add-video-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.add-video-form input,
.add-video-form textarea {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-input);
  color: white;
  width: 100%;
}

.add-video-form textarea {
  resize: vertical;
  min-height: 88px;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: var(--spacing-sm);
}

.add-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.add-btn:hover {
  background-color: var(--color-primary-dark);
}

.cancel-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-card-secondary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.cancel-btn:hover {
  background-color: var(--hover-color);
}

.delete-confirm {
  max-width: 400px;
}

.delete-confirm p {
  margin-bottom: var(--spacing-lg);
}

.delete-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-danger);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.delete-btn:hover {
  background-color: var(--color-danger-dark);
}

@media (max-width: 767px) {
  .video-watcher {
    width: 100vw;
    height: 100vh;
    padding: var(--spacing-xs);
  }
}
</style>
