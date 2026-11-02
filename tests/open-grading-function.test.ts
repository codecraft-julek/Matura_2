// Exercise the real Edge handler with mocked database/network boundaries. No paid AI requests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { admin } = vi.hoisted(() => ({ admin: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => admin }));

const id = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const source = "https://cke.gov.pl/images/_EGZAMIN_MATURALNY_OD_2023/Arkusze_egzaminacyjne/2025/";
let handler: (request: Request) => Promise<Response>;
let attempt: any;
let rows: any[];
let lease: string | null;
const fetchMock = vi.fn();
const grade = { number: "1", points: 1, reason: "Poprawnie wyjaśniasz jedną z dwóch przyczyn.", uncertain: false };
const response = (grades = [grade]) => new Response(JSON.stringify({
  status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ grades }) }] }],
}));
const call = () => handler(new Request("https://example.test/grade-open-answers", {
  method: "POST", headers: { authorization: "Bearer test-token" }, body: JSON.stringify({ attemptId: id }),
}));

beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks(); lease = null;
  attempt = {
    id, exam_id: "2025-maj-polski-pp", answers: { "1": "Jeden poprawny argument." },
    results: { "1": { status: "unchecked", points: 0, max: 2 } },
    exams: { subject: "polish", title: "Polski 2025", sheet_url: `${source}arkusz.pdf`, key_url: `${source}zasady.pdf`, transcript_url: `${source}transkrypcja.pdf` },
  };
  rows = [{ number: "1", points: 2, section: "test", meta: {}, group_label: "Zadanie otwarte", exam_task_keys: { display: "Dwa argumenty", note: "1 pkt za jeden argument." } }];
  admin.auth.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
  admin.from.mockImplementation(table => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: attempt ? structuredClone(attempt) : null })),
      order: vi.fn(async () => ({ data: rows })),
    };
    expect(["exam_attempts", "exam_tasks"]).toContain(table);
    return query;
  });
  admin.rpc.mockImplementation(async (name, args) => {
    if (name === "claim_open_grading") {
      if (lease) return { data: "busy" };
      lease = args.p_token;
      return { data: "claimed" };
    }
    if (name === "consume_plan_quota") return { data: { allowed: true } };
    if (name === "finish_open_grading") {
      expect(args.p_token).toBe(lease);
      for (const g of args.p_grades) attempt.results[g.number] = { ...attempt.results[g.number], status: "ai_graded", points: g.points };
      lease = null;
      return { data: args.p_grades.length };
    }
    if (name === "release_open_grading") { if (lease === args.p_token) lease = null; return { data: null }; }
    return { data: null };
  });
  vi.stubGlobal("Deno", { env: { get: (name: string) => name === "OPENAI_API_KEY" ? "fake-test-key" : undefined }, serve: (fn: typeof handler) => { handler = fn; } });
  fetchMock.mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../supabase/functions/grade-open-answers/index.ts");
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() });
const callsTo = (name: string) => admin.rpc.mock.calls.filter(([n]) => n === name);

describe("automatic grading Edge handler", () => {
  it("sends full answers and both official PDFs, then saves partial credit", async () => {
    attempt.answers["1"] = "x".repeat(3000);
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, graded: 1 });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input[0].content.slice(0, 2)).toEqual([
      { type: "input_file", file_url: attempt.exams.sheet_url }, { type: "input_file", file_url: attempt.exams.key_url },
    ]);
    expect(request.input[0].content.at(-1).text).toContain("x".repeat(3000));
    expect(request.store).toBe(false);
    expect(callsTo("finish_open_grading")[0][1].p_grades).toEqual([grade]);
    expect(callsTo("consume_plan_quota")).toHaveLength(1);
  });
  it("supports English listening and supplies the official transcript", async () => {
    attempt.exams.subject = "english";
    rows[0].section = "listening";
    expect((await call()).status).toBe(200);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input[0].content).toContainEqual({ type: "input_file", file_url: attempt.exams.transcript_url });
    expect(request.instructions).toContain("angielskiego");
  });
  it("reuses saved grades on another visit without another quota charge", async () => {
    await call();
    expect(await (await call()).json()).toEqual({ ok: true, graded: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callsTo("consume_plan_quota")).toHaveLength(1);
  });
  it.each(["correct", "empty", "self_correct", "self_partial", "self_incorrect", "ai_graded"])("leaves %s results untouched", async status => {
    attempt.results["1"].status = status;
    expect(await (await call()).json()).toEqual({ ok: true, graded: 0 });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("coordinates simultaneous requests without charging twice", async () => {
    let finish: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve }));
    const first = call();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await (await call()).json()).toEqual({ ok: true, pending: true, graded: 0 });
    expect(callsTo("consume_plan_quota")).toHaveLength(1);
    finish!(response());
    expect((await first).status).toBe(200);
  });
  it("refunds failed or incomplete output and releases the attempt for retry", async () => {
    fetchMock.mockImplementationOnce(async () => response([]));
    expect((await call()).status).toBe(502);
    expect(callsTo("finish_open_grading")).toHaveLength(0);
    expect(callsTo("refund_ai_quota")).toHaveLength(1);
    expect(lease).toBeNull();
    expect(attempt.results["1"].status).toBe("unchecked");
    expect((await call()).status).toBe(200);
  });
  it("fails closed before quota use when official listening context is missing", async () => {
    rows[0].section = "listening";
    attempt.exams.transcript_url = null;
    expect((await call()).status).toBe(503);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("checks ownership on the database query", async () => {
    attempt = null;
    expect((await call()).status).toBe(404);
    const query = admin.from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("user_id", "student");
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("rejects anonymous requests before reading answers", async () => {
    admin.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await call()).status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
  });
  it("releases the lease after a quota rejection without calling AI or refunding an unused credit", async () => {
    const original = admin.rpc.getMockImplementation()!;
    admin.rpc.mockImplementation((name, args) => name === "consume_plan_quota"
      ? Promise.resolve({ data: { allowed: false, reason: "user", plan: "free", limit: 2, period: "week" } }) : original(name, args));
    expect((await call()).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callsTo("refund_ai_quota")).toHaveLength(0);
    expect(lease).toBeNull();
  });
});
