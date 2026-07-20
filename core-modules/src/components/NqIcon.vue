<script setup lang="ts">
// Official Nimiq icons from the nimiq-icons Iconify set (MIT),
// bodies copied verbatim from nimiq-ui-kit/assets/nimiq-icons.json.
const ICONS = {
  'logos-nimiq': {
    viewBox: '0 0 20 18',
    body: '<g fill="none"><path fill="url(#nimiq-logos-nimiq-gfljr6)" d="M19.734 8.156 15.576.844A1.66 1.66 0 0014.135 0H5.819C5.226 0 4.677.32 4.38.844L.222 8.156a1.71 1.71 0 000 1.688l4.158 7.312c.297.523.846.844 1.439.844h8.316c.593 0 1.142-.32 1.438-.844l4.158-7.312c.3-.523.3-1.165.003-1.688"/><defs><radialGradient id="nimiq-logos-nimiq-gfljr6" cx="0" cy="0" r="1" gradientTransform="matrix(-19.9562 0 0 -18 19.956 18)" gradientUnits="userSpaceOnUse"><stop stop-color="#EC991C"/><stop offset="1" stop-color="#E9B213"/></radialGradient></defs></g>',
  },
  'logos-usdt': {
    viewBox: '0 0 18 18',
    body: '<path fill="#00B988" fill-rule="evenodd" d="M9 18A9 9 0 109 0a9 9 0 000 18M4.398 4.295h9.204v2.046h-3.58v2.045H7.978V6.341h-3.58zm3.58 4.091v4.091H5.931v-4.09zm2.045 0h2.045v4.091h-2.045v2.046H7.978v-2.046h2.045z" clip-rule="evenodd"/>',
  },
  'logos-nimiq-mono': {
    viewBox: '0 0 20 18',
    body: '<path fill="currentColor" d="M19.734 8.156 15.576.844A1.66 1.66 0 0014.135 0H5.819C5.226 0 4.677.32 4.38.844L.222 8.156a1.71 1.71 0 000 1.688l4.158 7.312c.297.523.846.844 1.439.844h8.316c.593 0 1.142-.32 1.438-.844l4.158-7.312c.3-.523.3-1.165.003-1.688"/>',
  },
  'logos-usdt-mono': {
    viewBox: '0 0 18 18',
    body: '<path fill="currentColor" fill-rule="evenodd" d="M9 18A9 9 0 109 0a9 9 0 000 18M4.398 4.295h9.204v2.046h-3.58v2.045H7.978V6.341h-3.58zm3.58 4.091v4.091H5.931v-4.09zm2.045 0h2.045v4.091h-2.045v2.046H7.978v-2.046h2.045z" clip-rule="evenodd"/>',
  },
  // Standard multicolor Google "G" (Google Identity branding guidelines)
  'logos-google': {
    viewBox: '0 0 48 48',
    body: '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>',
  },
} as const

defineProps<{
  name: keyof typeof ICONS
  size?: number
}>()

const icons = ICONS
</script>

<template>
  <svg
    :viewBox="icons[name].viewBox"
    :width="size ?? 20"
    :height="size ?? 20"
    aria-hidden="true"
    v-html="icons[name].body"
  />
</template>
