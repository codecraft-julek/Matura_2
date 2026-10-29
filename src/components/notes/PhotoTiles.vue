<script setup>
// Photo previews (3:4 tiles) with a remove button, plus the "add photo" tile and, optionally, an
// "add a file" tile (PDF / Word / PowerPoint, notes only). Used by notes and flashcards.
//   <PhotoTiles :photos="photos" :can-add="photos.length < 4" :busy="preparing" @add="onFiles" @remove="removePhoto" />
import { Camera, FileText, LoaderCircle, X } from '@lucide/vue'

defineProps({
  photos: { type: Array, required: true }, // [{ id, url }]
  canAdd: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  addHint: { type: String, default: 'aparat albo galeria' },
  /** Show the "Dodaj plik" tile. */
  docTile: { type: Boolean, default: false },
  docBusy: { type: Boolean, default: false },
})
const emit = defineEmits(['add', 'remove', 'doc'])

function onChange(e) {
  const files = [...(e.target.files ?? [])]
  e.target.value = '' // allow picking the same photo again
  if (files.length) emit('add', files)
}
function onDoc(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) emit('doc', file)
}
</script>

<template>
  <div class="tiles">
    <div v-for="(p, i) in photos" :key="p.id" class="tile photo">
      <img :src="p.url" :alt="`Zdjęcie ${i + 1}`" />
      <button type="button" class="remove" :aria-label="`Usuń zdjęcie ${i + 1}`" @click="emit('remove', p.id)"><X :size="16" /></button>
    </div>
    <label v-if="canAdd" class="tile add" :class="{ busy }">
      <input type="file" accept="image/*" multiple class="sr-only" :disabled="busy" @change="onChange" />
      <span class="add-icon" aria-hidden="true"><LoaderCircle v-if="busy" class="spin" :size="22" /><Camera v-else :size="22" /></span>
      <span class="add-title">{{ busy ? 'Wczytuję…' : 'Dodaj zdjęcie' }}</span>
      <span class="add-hint">{{ addHint }}</span>
    </label>
    <label v-if="docTile" class="tile add" :class="{ busy: docBusy }">
      <input type="file" accept=".pdf,.docx,.pptx,.doc,.ppt,application/pdf" class="sr-only" :disabled="docBusy" @change="onDoc" />
      <span class="add-icon is-doc" aria-hidden="true"><LoaderCircle v-if="docBusy" class="spin" :size="22" /><FileText v-else :size="22" /></span>
      <span class="add-title">{{ docBusy ? 'Czytam plik…' : 'Dodaj plik' }}</span>
      <span class="add-hint">PDF, Word, PowerPoint</span>
    </label>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 640px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.tile { position: relative; aspect-ratio: 3 / 4; border-radius: var(--radius); overflow: hidden; }
.photo { border: 1px solid var(--line-strong); background: var(--surface-2); }
.photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.remove { position: absolute; top: 6px; right: 6px; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); border: 1px solid var(--line); }
.remove:hover { background: var(--error); border-color: var(--error); color: white; }
.tile.add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 12px; text-align: center; border: 1.5px dashed var(--line-strong); background: var(--surface); cursor: pointer; transition: border-color .15s, background .15s; }
.tile.add:hover { border-color: var(--green); background: var(--surface-3); }
.tile.add:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
.tile.add.busy { cursor: progress; }
.add-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: var(--surface-2); color: var(--accent); margin-bottom: 6px; }
.add-icon.is-doc { background: #f5f0e5; color: #99885f; }
.add-title { font-size: 14px; font-weight: 700; }
.add-hint { font-size: 12px; color: var(--text-soft); }
</style>
