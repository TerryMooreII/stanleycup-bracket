<script setup>
defineProps({
  modelValue: { type: [String, Number], required: true },
  tabs: {
    type: Array,
    required: true,
    validator: (arr) => arr.every((t) => t && t.key != null && t.label != null),
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="tabs-root">
    <div class="tabs-bar" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        role="tab"
        :aria-selected="modelValue === t.key"
        class="tab-btn"
        :class="{ active: modelValue === t.key }"
        @click="$emit('update:modelValue', t.key)"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="tab-panel">
      <slot :name="String(modelValue)" :active="modelValue" />
      <slot :active="modelValue" />
    </div>
  </div>
</template>

<style scoped>
.tabs-bar {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 24px;
  background: none;
  color: var(--text-secondary);
  border: none;
  border-bottom: 1px solid transparent;
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.tab-btn:hover { color: var(--text-primary); }

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-panel { }
</style>
