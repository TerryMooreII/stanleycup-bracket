<script setup>
import zamboniImg from '../assets/zamboni.png'

defineProps({
  message: {
    type: String,
    default: 'Loading...'
  }
})
</script>

<template>
  <div class="zamboni-loader">
    <div class="zamboni-track">
      <img :src="zamboniImg" alt="Loading" class="zamboni" />
    </div>
    <p class="zamboni-message">{{ message }}</p>
  </div>
</template>

<style scoped>
.zamboni-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  filter: invert(1);
  opacity: 0.6;
}

.zamboni-track {
  width: 100%;
  max-width: 400px;
  position: relative;
  height: 100px;
}

.zamboni {
  width: 80px;
  height: auto;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  animation: zamboni-slide 3s ease-in-out infinite;
}

@keyframes zamboni-slide {
  0% {
    left: 0;
    transform: translateY(-50%) scaleX(1);
  }
  45% {
    left: calc(100% - 80px);
    transform: translateY(-50%) scaleX(1);
  }
  50% {
    left: calc(100% - 80px);
    transform: translateY(-50%) scaleX(-1);
  }
  95% {
    left: 0;
    transform: translateY(-50%) scaleX(-1);
  }
  100% {
    left: 0;
    transform: translateY(-50%) scaleX(1);
  }
}

.zamboni-message {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.95rem;
}
</style>
