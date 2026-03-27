<script setup>
import { getLogoUrl } from '../lib/logos'

const props = defineProps({
  compact: { type: Boolean, default: false },
  logo: { type: String, default: '' }
})

function getShieldUrl() {
  return props.logo || getLogoUrl('NHL')
}
</script>

<template>
  <div class="empty-matchup" :class="{ compact }">
    <img :src="getShieldUrl()" alt="TBD" class="shield" @error="$event.target.style.display='none'" />
  </div>
</template>

<style scoped>
.empty-matchup {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 200px;
  height: 114px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  flex-shrink: 0;
}

.empty-matchup.compact {
  width: 170px;
  height: 131px;
}

.shield {
  width: 36px;
  height: 36px;
  opacity: 0.4;
}
</style>
