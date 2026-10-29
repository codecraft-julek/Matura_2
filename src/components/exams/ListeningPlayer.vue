<script setup>
// The official CKE recording, played straight from cke.gov.pl (nothing is copied or re-hosted).
// One file has all listening tasks in order, with the pauses from the real exam.
// The parent keeps this mounted (v-show) so playback continues while moving between tasks.
import { Headphones } from '@lucide/vue'

defineProps({ src: { type: String, required: true } })
</script>

<template>
  <div class="listening">
    <div class="listening-head">
      <span class="listening-icon" aria-hidden="true"><Headphones :size="18" /></span>
      <div>
        <p class="listening-title">Nagranie do zadań ze słuchania</p>
        <p class="listening-text">Wszystkie zadania po kolei, z przerwami jak na maturze. Odpowiadaj w trakcie słuchania.</p>
      </div>
    </div>
    <audio controls preload="none" :src="src" class="listening-audio">
      Twoja przeglądarka nie odtwarza nagrań. <a :href="src" class="link">Pobierz MP3</a>.
    </audio>
  </div>
</template>

<style scoped>
.listening { padding: 16px; border-radius: var(--radius); background: var(--surface-3); border: 1px solid #e1e8d7; }
.listening-head { display: flex; gap: 12px; align-items: flex-start; }
.listening-icon { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: var(--lime); color: var(--green); }
.listening-title { font-family: var(--heading); font-weight: 750; font-size: 15px; }
.listening-text { margin-top: 3px; font-size: 13px; line-height: 1.55; color: var(--text-soft); }
.listening-audio { display: block; width: 100%; margin-top: 12px; }
</style>
