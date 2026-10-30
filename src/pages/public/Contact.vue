<script setup>
// Contact form. Talks straight to the Edge Function `contact-submit` (validation, honeypot, rate
// limit and CAPTCHA are checked there too). When logged in, the request carries the student's token,
// so the message is linked to the account and we can help faster.
import { nextTick, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CircleAlert, LoaderCircle, MailCheck, Send } from '@lucide/vue'
import { CONTACT_TOPICS, contactSchema } from '@shared/contact'
import { ROUTES } from '@/config/routes'
import { SITE } from '@/config/site'
import { callEdge } from '@/lib/edge'
import { useAuthStore } from '@/stores/auth'
import AppField from '@/ui/AppField.vue'
import Captcha, { captchaEnabled } from '@/ui/Captcha.vue'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.contact)

const MAX = 4000
const auth = useAuthStore()
const route = useRoute()
// These templates use existing server-validated topics, so no backend deployment is needed.
const requests = {
  odstapienie: { topic: 'other', message: 'Oświadczam, że odstępuję od umowy o Premium / Pakiet do matury.\nData zakupu: \nE-mail powiązany z zakupem: \nImię i nazwisko: ' },
  reklamacja: { topic: 'bug', message: 'Składam reklamację usługi.\nOpis problemu: \nData wystąpienia: \nOczekiwane rozwiązanie: ' },
  dane: { topic: 'other', message: 'Zgłoszenie dotyczące moich danych osobowych.\nZakres żądania: ' },
}
const requestKind = String(route.query.sprawa ?? '')
const initial = Object.hasOwn(requests, requestKind) ? requests[requestKind] : { topic: CONTACT_TOPICS[0].value, message: '' }
const form = reactive({ name: '', email: auth.email || '', ...initial, website: '' })
const errors = ref({})
const message = ref('')
const pending = ref(false)
const sent = ref(false)
const captchaToken = ref(null)
const captchaReset = ref(0)
const sentHeading = ref(null)

function validateField(field) {
  const parsed = contactSchema.safeParse(form)
  const issue = parsed.success ? null : parsed.error.issues.find(i => i.path[0] === field)
  errors.value = { ...errors.value, [field]: issue?.message ?? '' }
}

async function submit() {
  const payload = { ...form }
  const parsed = contactSchema.safeParse(payload)
  if (!parsed.success) {
    const out = {}
    for (const issue of parsed.error.issues) out[issue.path[0]] ??= issue.message
    errors.value = out
    message.value = 'Popraw zaznaczone pola.'
    return
  }
  if (captchaEnabled && !captchaToken.value) {
    message.value = 'Chwilka, sprawdzamy, czy nie jesteś botem. Spróbuj za moment.'
    return
  }

  errors.value = {}
  message.value = ''
  pending.value = true
  const res = await callEdge('contact-submit', { ...payload, captchaToken: captchaToken.value ?? undefined }, { auth: auth.isLoggedIn })
  pending.value = false
  captchaReset.value++ // a token works once
  if (res.ok) {
    sent.value = true
    await nextTick()
    sentHeading.value?.focus()
    return
  }
  errors.value = res.fieldErrors ?? {}
  message.value = res.error
}
</script>

<template>
  <div class="public-page contact-page">
    <header class="page-header">
      <div>
        <span class="page-kicker">Piszesz do ludzi, nie do bota</span>
        <h1>Kontakt<span class="accent-dot">.</span></h1>
        <p>Pytanie, coś nie działa albo masz pomysł, co dodać? Napisz, czytamy każdą wiadomość.</p>
      </div>
    </header>

    <div v-if="sent" class="card card-tinted sent" role="status">
      <span class="sent-icon"><MailCheck :size="24" /></span>
      <h2 ref="sentHeading" tabindex="-1">Dzięki, dostaliśmy!</h2>
      <p>Odpiszemy na podany adres e-mail, zwykle w ciągu 1–2 dni. Jeśli nie widzisz odpowiedzi, zajrzyj do spamu.</p>
    </div>

    <form v-else class="card form" novalidate @submit.prevent="submit">
      <div class="grid-2">
        <AppField v-slot="f" label="Imię" optional :error="errors.name">
          <input :id="f.id" v-model="form.name" name="name" class="input" autocomplete="given-name" maxlength="80" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
        </AppField>
        <AppField v-slot="f" label="E-mail" :error="errors.email">
          <input :id="f.id" v-model="form.email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="ty@gmail.com" class="input" :aria-invalid="f.invalid" :aria-describedby="f.describedby" @blur="form.email && validateField('email')" />
        </AppField>
      </div>

      <fieldset class="topic-field">
        <legend class="field-label">Temat</legend>
        <div class="chip-group">
          <label v-for="t in CONTACT_TOPICS" :key="t.value" class="chip"><input v-model="form.topic" type="radio" name="topic" :value="t.value" />{{ t.label }}</label>
        </div>
        <p v-if="errors.topic" class="field-error" role="alert">{{ errors.topic }}</p>
      </fieldset>

      <AppField v-slot="f" label="Wiadomość" :error="errors.message" :counter="form.message.length > MAX - 500 ? { value: form.message.length, max: MAX, unit: 'zn.' } : null">
        <textarea :id="f.id" v-model="form.message" name="message" rows="7" :maxlength="MAX" class="textarea" placeholder="Napisz, w czym możemy pomóc. Jeśli coś nie działa: co klikasz i co widzisz." :aria-invalid="f.invalid" :aria-describedby="f.describedby" @blur="form.message && validateField('message')"></textarea>
      </AppField>

      <!-- Honeypot: hidden from people (and screen readers), but bots fill it in. -->
      <div class="honeypot" aria-hidden="true">
        <label for="contact-website">Nie wypełniaj tego pola</label>
        <input id="contact-website" v-model="form.website" name="website" type="text" tabindex="-1" autocomplete="off" />
      </div>

      <Captcha :reset-key="captchaReset" @token="captchaToken = $event" />

      <div class="form-actions">
        <button type="submit" class="button button-dark" :disabled="pending" :aria-busy="pending">
          <LoaderCircle v-if="pending" :size="17" class="spin" /><Send v-else :size="17" />
          {{ pending ? 'Wysyłam…' : 'Wyślij wiadomość' }}
        </button>
      </div>
      <p v-if="message" class="alert alert-error" role="alert"><CircleAlert :size="18" /> {{ message }}</p>
    </form>

    <div class="contact-notes">
      <p>Wolisz zwykły e-mail? Pisz na <a :href="`mailto:${SITE.contactEmail}`" class="link">{{ SITE.contactEmail }}</a>.</p>
      <p>Dane wykorzystamy do obsługi zgłoszenia, ochrony przed nadużyciami i realizacji właściwych obowiązków prawnych. Więcej w <RouterLink :to="ROUTES.privacy" class="link">polityce prywatności</RouterLink>.</p>
    </div>
  </div>
</template>

<style scoped>
.contact-page { width: min(720px, calc(100% - 48px)); }
.topic-field { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.topic-field legend { padding: 0; margin-bottom: 10px; }
.honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.form { position: relative; }
.sent { text-align: center; padding: 36px 24px; }
.sent-icon { display: inline-grid; place-items: center; width: 54px; height: 54px; border-radius: 15px; background: var(--lime); color: var(--green); margin-bottom: 14px; }
.sent h2 { font-size: 24px; letter-spacing: -.6px; outline: none; }
.sent p { margin: 10px auto 0; max-width: 46ch; color: var(--text-soft); line-height: 1.6; }
.contact-notes { margin-top: 24px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--text-soft); line-height: 1.6; }
@media (max-width: 680px) { .contact-page { width: calc(100% - 32px); } }
</style>
