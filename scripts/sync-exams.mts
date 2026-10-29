// Loads content/exams/*.json into the Supabase database (exams, tasks, hidden answer keys).
//
//   npm run content:check   → only validate the files (also runs in CI)
//   npm run content:sync    → validate, then write to the Matura project
//
// Runs with plain Node (it understands TypeScript). Writes go through the Supabase CLI
// (`db query --linked`), so no secret key is needed on your computer.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examContentSchema, toRows, type ExamContent } from "../src/lib/exams/content.ts";

const PROJECT_REF = "mwtqlqbzsxeakqrjyxwg"; // Matura. Never point this at another project.
const dir = join(import.meta.dirname, "..", "content", "exams");
const checkOnly = process.argv.includes("--check");

// SQL string literal with quotes escaped. Content comes from our own JSON files.
const q = (v: string | null) => (v === null ? "null" : `'${v.replaceAll("'", "''")}'`);
const arr = (xs: string[]) => `array[${xs.map(q).join(",")}]::text[]`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const exams: ExamContent[] = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const parsed = examContentSchema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
  if (!parsed.success) {
    console.error(`✗ ${file}`);
    for (const issue of parsed.error.issues) console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  if (`${parsed.data.id}.json` !== file) {
    console.error(`✗ ${file}: file name must be "${parsed.data.id}.json"`);
    process.exit(1);
  }
  exams.push(parsed.data);
  const { tasks } = toRows(parsed.data);
  console.log(`✓ ${file}: ${tasks.length} tasks, ${parsed.data.maxPoints} pts`);
}

if (checkOnly) process.exit(0);

const sql: string[] = ["begin;"];
exams.forEach((exam, i) => {
  const { tasks, keys } = toRows(exam);
  sql.push(
    `insert into public.exams (id, subject, level, year, session, title, duration_minutes, max_points, sheet_url, key_url, audio_url, transcript_url, sheet2_url, published, sort)
     values (${q(exam.id)}, ${q(exam.subject)}, ${q(exam.level)}, ${exam.year}, ${q(exam.session)}, ${q(exam.title)}, ${exam.durationMinutes}, ${exam.maxPoints},
             ${q(exam.sources.sheet)}, ${q(exam.sources.key ?? null)}, ${q(exam.sources.audio ?? null)}, ${q(exam.sources.transcript ?? null)}, ${q(exam.sources.sheet2 ?? null)}, true, ${i})
     on conflict (id) do update set subject = excluded.subject, level = excluded.level, year = excluded.year,
       session = excluded.session, title = excluded.title, duration_minutes = excluded.duration_minutes,
       max_points = excluded.max_points, sheet_url = excluded.sheet_url, key_url = excluded.key_url,
       audio_url = excluded.audio_url, transcript_url = excluded.transcript_url, sheet2_url = excluded.sheet2_url, published = true, sort = excluded.sort;`,
    // Remove tasks that no longer exist in the file (their keys go with them).
    `delete from public.exam_tasks where exam_id = ${q(exam.id)} and id <> all (${arr(tasks.map((t) => t.id))});`,
  );
  for (const t of tasks) {
    sql.push(
      `insert into public.exam_tasks (id, exam_id, group_no, number, section, kind, options, points, sort, group_label, meta)
       values (${q(t.id)}, ${q(t.exam_id)}, ${t.group_no}, ${q(t.number)}, ${q(t.section)}, ${q(t.kind)}, ${arr(t.options)}, ${t.points}, ${t.sort}, ${q(t.group_label)}, ${json(t.meta)})
       on conflict (id) do update set group_no = excluded.group_no, section = excluded.section, kind = excluded.kind,
         options = excluded.options, points = excluded.points, sort = excluded.sort, group_label = excluded.group_label, meta = excluded.meta;`,
    );
  }
  for (const k of keys) {
    // normalize_answer() in SQL guarantees the stored list matches how answers are compared.
    sql.push(
      `insert into public.exam_task_keys (task_id, correct, accepted, display, note)
       values (${q(k.task_id)}, ${q(k.correct)}, array(select public.normalize_answer(x) from unnest(${arr(k.accepted)}) x), ${q(k.display)}, ${q(k.note)})
       on conflict (task_id) do update set correct = excluded.correct, accepted = excluded.accepted, display = excluded.display, note = excluded.note;`,
    );
  }
});
sql.push("commit;");

// Safety: refuse to write unless this folder is linked to the Matura project.
const linked = readFileSync(join(import.meta.dirname, "..", "supabase", ".temp", "project-ref"), "utf8").trim();
if (linked !== PROJECT_REF) {
  console.error(`✗ This folder is linked to "${linked}", not Matura (${PROJECT_REF}). Run: npx supabase@latest link --project-ref ${PROJECT_REF}`);
  process.exit(1);
}

const file = join(mkdtempSync(join(tmpdir(), "exams-")), "sync.sql");
writeFileSync(file, sql.join("\n"));
execFileSync("npx", ["-y", "supabase@2.121.0", "db", "query", "--linked", "--project-ref", PROJECT_REF, "-f", file], { stdio: "inherit" });
console.log(`Synced ${exams.length} exam(s) to project ${PROJECT_REF}.`);
