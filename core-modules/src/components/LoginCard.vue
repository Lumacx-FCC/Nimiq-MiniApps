<script setup lang="ts">
import { ref, watch } from 'vue'
import { getConfig, useAuth } from '../modules'
import NqIcon from './NqIcon.vue'

const auth = useAuth()
const appName = getConfig().appName

const email = ref('')
const password = ref('')
const mode = ref<'login' | 'signup'>('login')
const notice = ref<string | null>(null)
const showWebViewWarning = ref(false)

function onGoogleClick() {
  // Google blocks OAuth inside embedded WebViews — warn instead of failing.
  if (auth.canUseNimiq()) {
    showWebViewWarning.value = true
    return
  }
  if (!auth.canUseGoogle()) {
    notice.value = 'Google sign-in is not configured yet (needs the Google client ID).'
    return
  }
  auth.loginWithGoogle()
}

// After logout, present a clean login form again.
watch(auth.isLoggedIn, (loggedIn) => {
  if (!loggedIn) {
    mode.value = 'login'
    password.value = ''
    notice.value = null
  }
})

function submitEmail() {
  notice.value = null
  if (mode.value === 'signup')
    auth.signUpWithEmail(email.value, password.value)
  else
    auth.loginWithEmail(email.value, password.value)
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  notice.value = null
}

function forgotPassword() {
  notice.value = 'Password reset requires the production backend (Firebase) — coming with the full project.'
}
</script>

<template>
  <div class="nq-card">
    <template v-if="!auth.isLoggedIn.value">
      <h1 class="nq-h1 login-title">{{ appName.toUpperCase() }}</h1>
      <p class="nq-text login-subtitle">Sign in with Google, Nimiq or email.</p>

      <div class="google-btn-wrap">
        <button
          class="google-btn"
          :disabled="auth.isBusy.value"
          @click="onGoogleClick"
        >
          <NqIcon name="logos-google" :size="18" class="nq-icon" />
          Sign in with Google
        </button>
      </div>

      <div class="divider" role="separator"><span>OR</span></div>

      <div class="stack">
        <button
          class="nq-button"
          :disabled="auth.isBusy.value"
          @click="auth.loginWithNimiq()"
        >
          <NqIcon name="logos-nimiq-mono" :size="18" class="nq-icon" />
          {{ auth.isBusy.value ? 'Waiting for wallet…' : 'Login with Nimiq' }}
        </button>

        <form class="stack" @submit.prevent="submitEmail">
          <input
            v-model="email"
            class="nq-input"
            type="email"
            placeholder="Email"
            autocomplete="email"
            required
          >
          <input
            v-model="password"
            class="nq-input"
            type="password"
            placeholder="Password"
            :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            required
            minlength="8"
          >
          <button class="nq-button slate" type="submit" :disabled="auth.isBusy.value">
            {{ mode === 'signup' ? 'Create account' : 'Login with Email' }}
          </button>
        </form>
      </div>

      <p class="login-links">
        <template v-if="mode === 'login'">
          New to {{ appName }}? <a href="#" @click.prevent="toggleMode">Sign up</a>
        </template>
        <template v-else>
          Already have an account? <a href="#" @click.prevent="toggleMode">Log in</a>
        </template>
        <br>
        <a href="#" @click.prevent="forgotPassword">Forgot password?</a>
      </p>

      <p v-if="!auth.canUseNimiq()" class="nq-notice info">
        Open this app inside Nimiq Pay to sign in with your wallet.
      </p>
      <p v-if="notice" class="nq-notice info">{{ notice }}</p>
      <p v-if="auth.error.value" class="nq-notice error">{{ auth.error.value }}</p>

      <div v-if="showWebViewWarning" class="modal-overlay" @click.self="showWebViewWarning = false">
        <div class="modal" role="alertdialog" aria-label="Google sign-in unavailable">
          <h3 class="nq-h2">Google sign-in</h3>
          <p class="nq-text">Use only on external browser.</p>
          <p class="nq-text" style="font-size: 14px;">
            Inside Nimiq Pay, sign in with your Nimiq wallet instead.
          </p>
          <button class="nq-button" @click="showWebViewWarning = false">Got it</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="row">
        <div>
          <span class="nq-label">Signed in via {{ auth.user.value?.provider }}</span>
          <p class="mono" style="margin: 4px 0 0;">{{ auth.user.value?.label }}</p>
        </div>
        <button class="nq-button secondary" style="width: auto;" @click="auth.logout()">
          Log out
        </button>
      </div>
    </template>
  </div>
</template>
