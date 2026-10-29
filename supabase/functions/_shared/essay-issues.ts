import { z } from "zod";

// Ownership metadata for already detected issues; this module never detects new errors.
export const ISSUE_CRITERIA = ["spelling", "punctuation", "language", "style", "coherence", "literary"] as const;
export const detectedIssueSchema = z.object({
  id: z.string().min(1).max(80),
  criterion: z.enum(ISSUE_CRITERIA),
  quote: z.string().min(1).max(600),
  occurrence: z.number().int().min(1),
  correction: z.string().max(600).nullable(),
  comment: z.string().max(600),
  // An independent style defect must survive correcting the spelling (e.g. a vulgarism).
  styleAfterCorrection: z.string().max(600).nullable(),
});
export type DetectedIssue = z.infer<typeof detectedIssueSchema>;
export type AssignedIssue = DetectedIssue & { start: number; end: number; sourceIds: string[] };

export const issuesJsonSchema = {
  type: "array",
  description: "Rejestr wyłącznie błędów już wykrytych w tej analizie, również przy kryteriach wyzerowanych za długość. Nie dodawaj nowych błędów. Dla tekstu bez błędów zwróć []. Każde wystąpienie ma osobny wpis. Nie wpisuj tu brakujących mocnych stron ani limitu długości.",
  items: {
    type: "object", additionalProperties: false,
    required: ["id", "criterion", "quote", "occurrence", "correction", "comment", "styleAfterCorrection"],
    properties: {
      id: { type: "string" },
      criterion: { type: "string", enum: ISSUE_CRITERIA },
      quote: { type: "string", description: "Najkrótszy dokładny cytat lokalizujący błąd w tekście, bez zmiany pisowni." },
      occurrence: { type: "integer", minimum: 1, description: "Które wystąpienie tego dokładnego cytatu w tekście (od 1)." },
      correction: { type: ["string", "null"], description: "Poprawiona forma, jeśli wynika z wykrytego błędu; inaczej null." },
      comment: { type: "string", description: "Opis już wykrytego błędu, bez dodatkowych zarzutów." },
      styleAfterCorrection: { type: ["string", "null"], description: "Zwykle null. Tylko dla stylu: uzasadnienie, dlaczego POPRAWIONA ortograficznie forma nadal jest niestosowna. Samo ‘w ogóle’ nie jest takim problemem." },
    },
  },
};

const normalized = (text: string) => text.normalize("NFC").toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();
const priority = (issue: DetectedIssue) => ISSUE_CRITERIA.indexOf(issue.criterion);
const overlaps = (a: AssignedIssue, b: AssignedIssue) => a.start < b.end && b.start < a.end;

export function citesIssue(text: string, quote: string) {
  const needle = normalized(quote);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^[\p{L}\p{N}]/u.test(needle) ? "(?<![\\p{L}\\p{N}])" : "";
  const right = /[\p{L}\p{N}]$/u.test(needle) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${left}${escaped}${right}`, "u").test(normalized(text));
}

function locate(content: string, issue: DetectedIssue): AssignedIssue {
  let start = -1;
  for (let n = 0; n < issue.occurrence; n++) {
    start = content.indexOf(issue.quote, start + 1);
    if (start < 0) throw new Error(`Issue ${issue.id}: quote occurrence is not in the essay`);
  }
  return { ...issue, start, end: start + issue.quote.length, sourceIds: [issue.id] };
}

/** Called after detection and BEFORE final scoring/comment reconciliation. Does not mutate input. */
export function deduplicateIssues(issues: DetectedIssue[], content: string) {
  const ids = new Set<string>();
  const located = issues.map(issue => {
    if (ids.has(issue.id)) throw new Error(`Duplicate issue id: ${issue.id}`);
    ids.add(issue.id);
    return locate(content, issue);
  }).sort((a, b) => priority(a) - priority(b) || a.start - b.start || a.id.localeCompare(b.id));
  const assigned: AssignedIssue[] = [];
  const removed: { issue: AssignedIssue; owner: AssignedIssue }[] = [];
  for (const issue of located) {
    const owner = assigned.find(other => {
      if (!overlaps(other, issue)) return false;
      if (other.criterion === "spelling" && issue.criterion === "style") {
        // Keep an independently explained style issue, not a second penalty for misspelling.
        if (other.correction && issue.styleAfterCorrection?.trim()) return false;
        return true;
      }
      const sameSpan = other.start === issue.start && other.end === issue.end;
      const sameCorrection = other.correction && issue.correction && normalized(other.correction) === normalized(issue.correction);
      // A phrase can contain two different errors. Different fixes are not duplicates merely
      // because the quoted span is the same (e.g. punctuation and grammar in one sentence).
      return Boolean(sameCorrection || (sameSpan && other.criterion === issue.criterion && normalized(other.comment) === normalized(issue.comment) && !other.correction && !issue.correction));
    });
    if (owner) {
      owner.sourceIds.push(issue.id);
      removed.push({ issue, owner });
    } else assigned.push(issue);
  }
  return {
    issues: assigned.sort((a, b) => a.start - b.start || priority(a) - priority(b)),
    removed,
    affectedCriteria: [...new Set(removed.map(({ issue }) => issue.criterion))],
  };
}

export type IssueReconciliation = ReturnType<typeof deduplicateIssues>;
