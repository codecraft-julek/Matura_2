// Small form helpers for the account and auth forms: validation on blur (and live once a field
// shows an error), and moving focus to the first invalid field after a failed submit.

import { nextTick, reactive } from 'vue'

/** First message of a zod schema for one value, or '' when it passes. */
export function schemaError(schema, value) {
  const result = schema.safeParse(value)
  return result.success ? '' : (result.error.issues[0]?.message ?? '')
}

/**
 * const f = useFieldErrors({ email: v => schemaError(emailSchema, v) })
 *   @blur="f.blur('email', email)"  @input="f.input('email', email)"
 *   f.errors.email, f.set({ ... }) after a submit, f.clear()
 * Leaving an empty, untouched field shows nothing (tabbing through the form is not an error).
 */
export function useFieldErrors(validators) {
  const errors = reactive({})
  const touched = new Set()

  function check(name, value) {
    errors[name] = validators[name]?.(value) ?? ''
    return errors[name]
  }
  function blur(name, value) {
    if (!touched.has(name) && (value === '' || value == null)) return
    touched.add(name)
    check(name, value)
  }
  /** While a field shows an error, re-check on every keystroke so it disappears as soon as it's fixed. */
  function input(name, value) {
    if (errors[name]) check(name, value)
  }
  function set(next) {
    for (const key of Object.keys(errors)) errors[key] = ''
    Object.assign(errors, next)
    for (const key of Object.keys(next)) touched.add(key)
  }
  function clear() { set({}) }
  return { errors, check, blur, input, set, clear }
}

/** After a failed submit: focus the first field marked aria-invalid inside `root`. */
export async function focusFirstInvalid(root) {
  await nextTick()
  root?.querySelector('[aria-invalid="true"]')?.focus()
}
