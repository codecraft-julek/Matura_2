<script setup>
import { ref } from 'vue'
import AnalyticsChoice from './AnalyticsChoice.vue'
import { clearLocalStudyData } from '@/lib/privacy/consent'
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
const result = ref('')
async function clearDrafts() {
  if (!await ui.confirm({ title: 'Usunąć lokalne szkice i postęp?', body: 'Usuniemy niewysłane szkice, lokalny postęp treningu i odpowiedzi zapisane na tym urządzeniu. Dane wysłane na konto pozostaną bez zmian. Zamknij inne karty z otwartą pracą, aby nie zapisały jej ponownie.', confirmLabel: 'Usuń lokalne dane', danger: true })) return
  try { clearLocalStudyData(window.localStorage); result.value = 'Usunięto lokalne szkice i postęp z tej przeglądarki.' }
  catch { result.value = 'Nie udało się wyczyścić pamięci. Użyj ustawień danych witryny w przeglądarce.' }
}
</script>

<template>
  <div class="privacy-controls no-print">
    <AnalyticsChoice />
    <div class="local-data"><h3>Dane zapisane na tym urządzeniu</h3><p>Możesz usunąć lokalne szkice i postęp bez wylogowania z konta.</p><button type="button" class="button button-outline" @click="clearDrafts">Usuń lokalne szkice i postęp</button><p v-if="result" role="status">{{ result }}</p></div>
  </div>
</template>

<style scoped>
.privacy-controls{background:var(--surface-3);border:1px solid var(--line);border-radius:var(--radius);padding:24px;margin-top:24px}
.local-data{border-top:1px solid var(--line);margin-top:24px;padding-top:24px}.local-data h3{font-size:17px}.local-data p{font-size:14px}
</style>
