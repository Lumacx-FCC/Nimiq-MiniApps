<script setup lang="ts">
import type { CreditPack } from '../modules'
import { onMounted, ref, watch } from 'vue'
import { useAuth, useCredits } from '../modules'
import NqIcon from './NqIcon.vue'

const auth = useAuth()
const credits = useCredits()

const packs = credits.packs()
const selected = ref<CreditPack>(packs[1] ?? packs[0])
const nimQuote = ref<{ credits: number, amount: number, rateIsLive: boolean } | null>(null)
const lastTx = ref<string | null>(null)

async function refreshNimQuote(pack: CreditPack) {
  nimQuote.value = null
  nimQuote.value = await credits.quoteNimFor(pack)
}

onMounted(() => refreshNimQuote(selected.value))
watch(selected, pack => refreshNimQuote(pack))

watch(auth.user, (user) => {
  if (user)
    credits.loadFor(user.id)
}, { immediate: true })

function formatUsd(usd: number): string {
  return usd < 1 ? `$${usd.toFixed(2)}` : `$${usd}`
}

async function buy(method: 'usdt' | 'nim' | 'paypal') {
  lastTx.value = null
  if (method === 'usdt')
    await credits.buyWithUsdt(selected.value)
  else if (method === 'nim')
    await credits.buyWithNim(selected.value)
  else
    await credits.buyWithPaypal(selected.value)
  if (!credits.error.value)
    lastTx.value = credits.history.value[0]?.txHash ?? null
}
</script>

<template>
  <div v-if="auth.isLoggedIn.value" class="nq-card">
    <span class="nq-label">Your credits</span>
    <p class="balance">{{ credits.balance.value }}</p>

    <div class="highlights">
      <span v-for="h in credits.highlights()" :key="h" class="highlight-chip">{{ h }}</span>
    </div>

    <h2 class="nq-h2" style="margin-top: 24px;">Add credits</h2>

    <div class="pack-grid">
      <button
        v-for="pack in packs"
        :key="pack.usd"
        class="pack"
        :class="{ selected: pack.usd === selected.usd }"
        @click="selected = pack"
      >
        <span v-if="pack === packs[1]" class="pack-tag">Popular</span>
        <span class="pack-credits">{{ pack.credits.toLocaleString() }}</span>
        <span class="pack-unit">credits</span>
        <span class="pack-price">{{ formatUsd(pack.usd) }}</span>
      </button>
    </div>

    <div class="stack" style="margin-top: 16px;">
      <button
        class="nq-button green"
        :disabled="credits.isPaying.value"
        @click="buy('usdt')"
      >
        <NqIcon name="logos-usdt-mono" :size="18" class="nq-icon" />
        {{ formatUsd(selected.usd) }} USDT → {{ selected.credits.toLocaleString() }} credits
      </button>
      <button
        class="nq-button gold"
        :disabled="credits.isPaying.value || !nimQuote"
        @click="buy('nim')"
      >
        <template v-if="nimQuote">
          <NqIcon name="logos-nimiq-mono" :size="18" class="nq-icon" />
          {{ Math.ceil(nimQuote.amount).toLocaleString() }} NIM → {{ nimQuote.credits.toLocaleString() }} credits (+50% bonus)
        </template>
        <template v-else>Loading NIM price…</template>
      </button>
      <p v-if="nimQuote && !nimQuote.rateIsLive" class="muted">
        Using fallback NIM rate — live price unavailable.
      </p>

      <!-- PayPal placeholders: browser-only distribution. Hidden in the
           competition build (rules ban third-party payment providers). -->
      <template v-if="credits.isPaypalEnabled()">
        <button class="paypal-btn" :disabled="credits.isPaying.value" @click="buy('paypal')">
          <span class="paypal-word"><i>Pay</i><b>Pal</b></span>
        </button>
        <button class="card-btn" :disabled="credits.isPaying.value" @click="buy('paypal')">
          💳 Debit or Credit Card
        </button>
        <p class="muted" style="text-align: center;">Powered by PayPal</p>
      </template>
    </div>

    <p v-if="credits.isPaying.value" class="nq-notice info">
      Confirm the payment in Nimiq Pay…
    </p>
    <p v-if="credits.error.value" class="nq-notice error">{{ credits.error.value }}</p>
    <p v-if="lastTx" class="nq-notice success">
      Payment sent! <span class="mono">{{ lastTx.slice(0, 18) }}…</span>
    </p>

    <template v-if="credits.history.value.length">
      <span class="nq-label" style="display: block; margin-top: 20px;">Recent purchases</span>
      <div v-for="tx in credits.history.value" :key="tx.txHash" class="row" style="margin-top: 8px;">
        <span class="muted">{{ tx.method.toUpperCase() }} · +{{ tx.credits.toLocaleString() }} credits</span>
        <span class="muted">{{ new Date(tx.at).toLocaleDateString() }}</span>
      </div>
    </template>
  </div>
</template>
