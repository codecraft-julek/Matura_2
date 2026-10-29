-- How long each AI analysis took and how many tokens it used.
-- Lets you see real speed and cost per check (see README → "AI cost & speed").
alter table public.essays
  add column duration_ms int check (duration_ms >= 0),
  add column usage jsonb; -- { input_tokens, cached_tokens, output_tokens, reasoning_tokens }
