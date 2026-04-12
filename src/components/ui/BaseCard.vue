<script setup>
defineProps({
  padding: {
    type: String,
    default: 'md',
    validator: (v) => ['none', 'sm', 'md', 'lg'].includes(v),
  },
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'nested'].includes(v),
  },
  interactive: { type: Boolean, default: false },
  radius: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
})
</script>

<template>
  <div
    class="base-card"
    :class="[
      `pad-${padding}`,
      `variant-${variant}`,
      `radius-${radius}`,
      { interactive },
    ]"
  >
    <header v-if="$slots.header" class="card-header">
      <slot name="header" />
    </header>
    <div class="card-body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.base-card {
  border: 1px solid var(--border);
  transition: background 0.2s, border-color 0.2s;
}

.variant-default { background: var(--bg-card); }
.variant-nested { background: var(--bg-primary); }

.radius-sm { border-radius: 6px; }
.radius-md { border-radius: 10px; }
.radius-lg { border-radius: 12px; }

.pad-none { padding: 0; }
.pad-sm { padding: 8px; }
.pad-md { padding: 16px; }
.pad-lg { padding: 24px; }

.interactive { cursor: pointer; }
.interactive:hover {
  background: var(--bg-card-hover);
  border-color: var(--text-secondary);
}

.card-header {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
