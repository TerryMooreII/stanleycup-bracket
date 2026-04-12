<script setup>
defineProps({
  variant: {
    type: String,
    default: 'secondary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger', 'success', 'info'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v),
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="base-btn"
    :class="[`variant-${variant}`, `size-${size}`, { block, loading }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.size-sm {
  padding: 6px 14px;
  font-size: 0.8rem;
  border-radius: 6px;
}
.size-md {
  padding: 10px 18px;
  font-size: 0.9rem;
}

.block {
  width: 100%;
}

.variant-primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}
.variant-primary:hover:not(:disabled) {
  background: var(--accent-light);
  border-color: var(--accent-light);
  color: var(--bg-primary);
}

.variant-secondary {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}
.variant-secondary:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}

.variant-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}
.variant-ghost:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-primary);
}

.variant-danger {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}
.variant-danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
}

.variant-success {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success);
  border-color: var(--success);
}
.variant-success:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.25);
}

.variant-info {
  background: transparent;
  color: var(--info);
  border-color: var(--info);
}
.variant-info:hover:not(:disabled) {
  background: rgba(33, 150, 243, 0.12);
}

.base-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
