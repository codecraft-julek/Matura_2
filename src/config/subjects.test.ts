import { describe, expect, it } from "vitest";
import { SUBJECTS as PROFILE_SUBJECTS } from "@shared/waitlist";
import { SUBJECT_LABEL } from "@/lib/exams/labels";
import { CONTENT_SUBJECTS, SUBJECTS, SUBJECT_IDS, isSubjectId, subjectById } from "./subjects";

describe("subject config", () => {
  it("lists the same subjects as the profile enum shared with the Edge Functions, in the same order", () => {
    expect(SUBJECT_IDS).toEqual(PROFILE_SUBJECTS.map((s) => s.value));
    expect(SUBJECTS.map((s) => s.short)).toEqual(PROFILE_SUBJECTS.map((s) => s.label));
  });

  it("uses the exam labels for its long names", () => {
    for (const s of SUBJECTS) expect(s.label).toBe(SUBJECT_LABEL[s.id]);
  });

  it("knows which ids are subjects", () => {
    expect(isSubjectId("biology")).toBe(true);
    expect(isSubjectId("maths")).toBe(false);
    expect(isSubjectId(null)).toBe(false);
    expect(subjectById("english")?.from).toBe("z angielskiego");
    expect(subjectById("other")).toBeNull();
  });

  it("offers notes and decks the subjects plus 'Inne'", () => {
    expect(CONTENT_SUBJECTS.map((s) => s.value)).toEqual([...SUBJECT_IDS, "other"]);
  });
});
