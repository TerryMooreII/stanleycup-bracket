<script setup>
defineProps({
  modelValue: { type: [String, Number], required: true },
  options: {
    type: Array,
    required: true,
    validator: (arr) => arr.every((o) => o && o.value != null && o.label != null),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v),
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="btn-group" :class="`size-${size}`" role="group">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="group-btn"
      :class="{ active: modelValue === opt.value }"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.btn-group {
  display: inline-flex;
  gap: 0;
}

.group-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.size-sm .group-btn { padding: 8px 16px; font-size: 0.85rem; }
.size-md .group-btn { padding: 10px 20px; font-size: 0.9rem; }

.group-btn:first-child { border-radius: 6px 0 0 6px; }
.group-btn:last-child { border-radius: 0 6px 6px 0; }
.group-btn:not(:last-child) { border-right: none; }

.group-btn:hover:not(.active) {
  color: var(--text-primary);
}

.group-btn.active {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}
</style>
