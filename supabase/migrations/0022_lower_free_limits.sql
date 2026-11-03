-- Lower AI limits on the free plan. Keep the texts in src/config/plans.ts and
-- src/components/premium/planDetails.js in sync.
update public.plan_limits set max_uses = 1 where plan = 'free' and feature = 'essay_feedback';
update public.plan_limits set max_uses = 1 where plan = 'free' and feature = 'open_grading';
update public.plan_limits set max_uses = 5 where plan = 'free' and feature = 'tutor';
update public.plan_limits set max_uses = 1 where plan = 'free' and feature = 'notes';
update public.plan_limits set max_uses = 2 where plan = 'free' and feature = 'flashcards';
