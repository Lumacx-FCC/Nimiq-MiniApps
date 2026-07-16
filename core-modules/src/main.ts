import { createApp } from 'vue'
import App from './App.vue'
import { configure } from './modules'
import './style.css'

configure({
  appId: 'fcc-core-demo',
  // paypalEnabled: true, // Browser-only builds ONLY — banned inside Nimiq Pay by competition rules.
  // TODO: team treasury addresses + Google client ID before shipping.
})

createApp(App).mount('#app')
