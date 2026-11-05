<script setup>
// A creator's numbers: totals, months, recent payments and payouts. The same block on /creators
// and on /admin (where payouts can be removed). `panel` = my_affiliate_panel() / admin_affiliate().
import { Banknote, Clock, Trash2, Users, Wallet } from '@lucide/vue'
import { formatPln } from '@shared/affiliates'
import { count, formatDate } from '@/lib/format'
import EmptyState from '@/ui/EmptyState.vue'
import StatTile from '@/ui/StatTile.vue'

defineProps({
  panel: { type: Object, required: true },
  /** Shows payout notes and a remove button. */
  admin: { type: Boolean, default: false },
})
defineEmits(['delete-payout'])

const PEOPLE = ['osoba', 'osoby', 'osób']
const PAYMENTS = ['płatność', 'płatności', 'płatności']
const PLAN_NAMES = { monthly: 'Premium miesięczne', matura: 'Pakiet do matury' }
const monthFmt = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })
const monthName = month => monthFmt.format(new Date(`${month}T12:00:00`))
const day = date => formatDate(`${date}T12:00:00`)
</script>

<template>
  <div class="stat-grid">
    <StatTile :icon="Users" label="Osoby z kodem" :value="panel.buyers" :sub="count(panel.payments, PAYMENTS)" />
    <StatTile :icon="Wallet" tone="lime" label="Do wypłaty teraz" :value="formatPln(panel.due)" />
    <StatTile :icon="Clock" label="Czeka na termin" :value="formatPln(panel.waiting)" sub="Sprzedaż z ostatnich tygodni" />
    <StatTile :icon="Banknote" label="Wypłacone" :value="formatPln(panel.paidOut)" :sub="`Zarobione łącznie: ${formatPln(panel.earned)}`" />
  </div>
  <p class="payout-note">Prowizję za dany miesiąc wypłacamy 15. dnia następnego miesiąca, bo kupujący ma 14 dni na odstąpienie od umowy. Po zwrocie pieniędzy prowizja od tej płatności maleje, a jeśli była już wypłacona, odejmujemy ją od kolejnej wypłaty.</p>

  <EmptyState v-if="!panel.months.length" class="section-gap" :icon="Users" title="Jeszcze nikt nie użył tego kodu" text="Pierwsza płatność pojawi się tu od razu po zakupie." />
  <template v-else>
    <section class="section-gap" aria-labelledby="months-heading">
      <h2 id="months-heading" class="section-title">Miesiące</h2>
      <ul class="list">
        <li v-for="m in panel.months" :key="m.month" class="list-row">
          <div>
            <strong class="row-title">{{ monthName(m.month) }}</strong>
            <span class="row-meta">{{ count(m.buyers, PEOPLE) }} · {{ count(m.payments, PAYMENTS) }} · wypłata od {{ day(m.payoutOn) }}</span>
          </div>
          <strong class="tabular row-amount">{{ formatPln(m.commission) }}</strong>
        </li>
      </ul>
    </section>

    <section class="section-gap" aria-labelledby="sales-heading">
      <h2 id="sales-heading" class="section-title">Ostatnie płatności</h2>
      <ul class="list">
        <li v-for="(s, i) in panel.sales" :key="`${s.paidAt}-${i}`" class="list-row">
          <div>
            <strong class="row-title">{{ PLAN_NAMES[s.plan] }}</strong>
            <span class="row-meta">{{ formatDate(s.paidAt) }} · zapłacono {{ formatPln(s.amountPaid) }}</span>
          </div>
          <div class="row-end">
            <span v-if="s.refundedAmount" class="badge badge-warn">{{ s.refundedAmount >= s.amountPaid ? 'Zwrot' : `Zwrot ${formatPln(s.refundedAmount)}` }}</span>
            <strong class="tabular row-amount">{{ formatPln(s.commission) }}</strong>
          </div>
        </li>
      </ul>
    </section>
  </template>

  <section v-if="panel.payouts.length" class="section-gap" aria-labelledby="payouts-heading">
    <h2 id="payouts-heading" class="section-title">Wypłaty</h2>
    <ul class="list">
      <li v-for="(p, i) in panel.payouts" :key="p.id ?? `${p.paidAt}-${i}`" class="list-row">
        <div>
          <strong class="row-title">{{ formatDate(p.paidAt) }}</strong>
          <span v-if="admin && p.note" class="row-meta">{{ p.note }}</span>
        </div>
        <div class="row-end">
          <strong class="tabular row-amount">{{ formatPln(p.amount) }}</strong>
          <button v-if="admin" type="button" class="icon-button" :aria-label="`Usuń wypłatę z ${formatDate(p.paidAt)}`" @click="$emit('delete-payout', p)"><Trash2 :size="17" /></button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.payout-note { margin-top: 14px; font-size: 13px; line-height: 1.6; color: var(--text-soft); }
.row-title { display: block; font-size: 15px; }
.row-meta { display: block; margin-top: 3px; font-size: 13px; line-height: 1.5; color: var(--text-soft); overflow-wrap: anywhere; }
.row-end { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.row-amount { font-size: 16px; white-space: nowrap; }
</style>
