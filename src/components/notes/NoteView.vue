<script setup>
// The whole note: "w skrócie", warnings, the blocks, then flashcards (+ save as deck) and the quiz.
import { TriangleAlert } from '@lucide/vue'
import NoteBlock from './NoteBlock.vue'
import NoteFlashcards from './NoteFlashcards.vue'
import NoteQuiz from './NoteQuiz.vue'
import SaveNoteDeck from './SaveNoteDeck.vue'

defineProps({ note: { type: Object, required: true }, noteId: { type: String, required: true } })
</script>

<template>
  <div class="note-view">
    <section v-if="note.summary?.length" class="summary">
      <p class="summary-kicker">w skrócie</p>
      <ul>
        <li v-for="(s, i) in note.summary" :key="i">{{ s }}</li>
      </ul>
    </section>

    <div v-if="note.warnings?.length" role="note" class="alert alert-warn">
      <TriangleAlert :size="18" />
      <span><strong>Uwaga:</strong> {{ note.warnings.join(' ') }}</span>
    </div>

    <NoteBlock v-for="(b, i) in note.blocks" :key="i" :block="b" />

    <div v-if="note.flashcards?.length || note.quiz?.length" class="note-extras">
      <NoteFlashcards :cards="note.flashcards ?? []" />
      <SaveNoteDeck v-if="note.flashcards?.length" :note-id="noteId" :count="note.flashcards.length" />
      <NoteQuiz :questions="note.quiz ?? []" />
    </div>
  </div>
</template>

<style scoped>
.note-view { display: flex; flex-direction: column; gap: 18px; }
.summary { break-inside: avoid; padding: 22px 24px; border-radius: var(--radius-lg); background: var(--green); color: white; }
.summary-kicker { font-size: 11px; font-weight: 750; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lime); }
.summary ul { display: flex; flex-direction: column; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
.summary li { position: relative; padding-left: 20px; font-size: 15.5px; line-height: 1.6; }
.summary li::before { content: ''; position: absolute; left: 2px; top: .6em; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); }
.note-extras { display: flex; flex-direction: column; gap: 30px; margin-top: 14px; padding-top: 30px; border-top: 1px dashed var(--line-strong); }
@media print {
  .note-view { gap: 12px; }
  .summary { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .note-extras { margin-top: 6px; padding-top: 16px; gap: 12px; }
}
</style>
