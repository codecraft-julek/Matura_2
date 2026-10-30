<script setup>
import { Download, Printer } from '@lucide/vue'
import { documentDownloadPath } from '@/content/legal/render'

defineProps({ document: { type: Object, required: true } })
const printDocument = () => window.print()
</script>

<template>
  <article class="public-page legal-page">
    <p class="legal-draft" role="note">{{ document.notice }}</p>
    <header>
      <h1>{{ document.title }}<span class="accent-dot">.</span></h1>
      <p>Aktualizacja: {{ document.updated }} · Wersja {{ document.version }}</p>
      <p class="legal-lead">{{ document.summary }}</p>
      <div class="legal-actions">
        <a :href="documentDownloadPath(document)" download class="button button-outline"><Download :size="16" /> Pobierz dokument (HTML)</a>
        <button type="button" class="button button-outline" @click="printDocument"><Printer :size="16" /> Drukuj / zapisz PDF</button>
      </div>
    </header>
    <nav class="legal-toc" aria-label="Spis treści">
      <strong>W tym dokumencie</strong>
      <ol><li v-for="section in document.sections" :key="section.id"><a :href="`#${section.id}`">{{ section.title }}</a></li></ol>
    </nav>
    <div class="prose">
      <section v-for="section in document.sections" :id="section.id" :key="section.id">
        <h2>{{ section.title }}</h2>
        <template v-for="(block, index) in section.blocks" :key="index">
          <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
          <ul v-else-if="block.type === 'list'"><li v-for="item in block.items" :key="item">{{ item }}</li></ul>
          <ul v-else-if="block.type === 'links'" class="legal-links"><li v-for="item in block.items" :key="item.href"><a :href="item.href">{{ item.label }}</a></li></ul>
          <div v-else-if="block.type === 'table'" class="legal-table" role="region" :aria-label="section.title" tabindex="0">
            <table><thead><tr><th v-for="header in block.headers" :key="header" scope="col">{{ header }}</th></tr></thead>
              <tbody><tr v-for="row in block.rows" :key="row[0]"><template v-for="(cell, column) in row" :key="column"><th v-if="column === 0" scope="row">{{ cell }}</th><td v-else>{{ cell }}</td></template></tr></tbody>
            </table>
          </div>
        </template>
        <slot name="after-section" :section="section" />
      </section>
    </div>
  </article>
</template>
