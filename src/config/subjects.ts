// The subjects the app teaches, in one place: the order of menus and lists, the labels and the
// colours in the subject switcher (the pictograms live in components/layout/SubjectGlyph). The ids match SUBJECTS in @shared/waitlist (the
// profile enum shared with the Edge Functions; subjects.test.ts keeps the two lists in step) and
// the check constraints in the database (supabase/migrations). To add a subject: add it to both
// lists, to SUBJECT_LABEL in @/lib/exams/labels and to the constraints, then load its sheets.

import type { SubjectValue } from "@shared/waitlist";

export type SubjectId = SubjectValue;

export type Subject = {
  id: SubjectId;
  /** "Język polski": headings and the switcher. */
  label: string;
  /** "Polski": chips and small badges. */
  short: string;
  /** "z polskiego": "notatki z polskiego", "arkusze z biologii". */
  from: string;
  /** The pictogram colour, and the tinted square behind it (components/layout/SubjectIcon). */
  color: string;
  tint: string;
};

export const SUBJECTS: readonly Subject[] = [
  { id: "polish", label: "Język polski", short: "Polski", from: "z polskiego", color: "#5a6f3d", tint: "#e8efd9" },
  { id: "english", label: "Język angielski", short: "Angielski", from: "z angielskiego", color: "#6b4fa0", tint: "#ebe4f6" },
  { id: "biology", label: "Biologia", short: "Biologia", from: "z biologii", color: "#1f7f6d", tint: "#dcf1ea" },
  { id: "chemistry", label: "Chemia", short: "Chemia", from: "z chemii", color: "#1f5f8f", tint: "#dbe9f5" },
];

export const SUBJECT_IDS: readonly SubjectId[] = SUBJECTS.map((s) => s.id);

export const isSubjectId = (value: unknown): value is SubjectId => SUBJECT_IDS.includes(value as SubjectId);

export const subjectById = (id: string | null | undefined): Subject | null => SUBJECTS.find((s) => s.id === id) ?? null;

/** Notes and flashcard decks can also be about something else: the same list plus "Inne". */
export const CONTENT_SUBJECTS: readonly { value: SubjectId | "other"; label: string }[] = [
  ...SUBJECTS.map((s) => ({ value: s.id, label: s.short })),
  { value: "other", label: "Inne" },
];
