<script setup lang="ts">
import CreditsCard from './components/CreditsCard.vue'
import LoginCard from './components/LoginCard.vue'
import { useTheme } from './modules'
import iconDark from './assets/otherme-icon-dark.png'
import iconLight from './assets/otherme-icon-light.png'

const { isDark, toggle } = useTheme()
</script>

<template>
  <!-- Internal name: Core Modules (login + credits MVP, reusable across our mini apps) -->
  <header class="row" style="padding: 8px 0 16px; align-items: flex-start;">
    <h1 class="nq-h1 row" style="justify-content: flex-start; gap: 10px; margin: 0;">
      Welcome to
      <img :src="isDark ? iconDark : iconLight" alt="OtherMe" class="app-logo">
    </h1>
    <button
      class="theme-toggle"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggle()"
    >
      {{ isDark ? '☀️' : '🌙' }}
    </button>
  </header>
  <LoginCard />
  <CreditsCard />
</template>
