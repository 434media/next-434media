# The exam (IMP-27)

434 build sequence V1 item 3. One runner, one suite format, any executor. A suite is fixtures plus assertions, never a
runner, so the same suite judges our engine and a recorded run from another vendor.

| File | What it is |
|---|---|
| `suite.ts` | The suite and case format (zod), the loader, and the suite's fingerprint |
| `assertions.ts` | The deterministic checks, and the output shape every executor returns |
| `mock-tools.ts` | The only tools the exam offers: mocks that record each call, check the caller's scope and return a canned result |
| `executors.ts` | `recordedExecutor` (scores outputs produced elsewhere), `engineExecutor` (our engine: the SKILL.md loader through the AI Gateway), `modelJudge` |
| `runner.ts` | `runSuite` and `reportMarkdown`: pass or fail with the reason per case, and the run log of tokens and cost |
| `suites/baseline/` | Invented cases for the four build plan v3 behaviours |

## Where suites live

Business suites (Polí, Smartie, scheduling and confirmations, MilCityUSA content) carry business content, so they live
with the skill's evals in 434-context (Skill Building Standard §8), never in this public repository. The runner reads
them from a path. The baseline suite here is invented data only.

## Adding a case: a file, no code

Put a JSON file in the suite's `cases/` folder: one case, or `{ "cases": [ ... ] }`. A case names what it asks, what it
is given, and what must be true of the output:

```json
{
  "id": "sched-01",
  "title": "Confirm a call time",
  "category": "scheduling",
  "author": "Guna",
  "source": "where this case came from",
  "input": {
    "today": "2026-11-10",
    "caller": { "id": "ops@example.com", "scope": { "recipients": ["*@example.com"], "properties": ["brand-a"] } },
    "request": "Confirm Tuesday 3 PM with Lee.",
    "inbound": [{ "from": "lee@example.com", "subject": "Tuesday?", "body": "Does 3 PM work?" }],
    "decisions": [{ "id": "D-1", "decided": "No calls before 10 AM.", "why": "..." }]
  },
  "expect": [
    { "type": "tool_called", "tool": "create_draft", "args": { "to": ["lee@example.com"] } },
    { "type": "tool_not_called", "tool": "send_email", "why": "draft mode sends nothing" },
    { "type": "completion" }
  ],
  "reference": "the approved reply, where there is one"
}
```

The loader refuses a case that names a tool the suite does not define, repeats an id, or carries a bad pattern, and says
which. Checks:

| `type` | Passes when |
|---|---|
| `contains`, `not_contains` | the text (and/or tool arguments: `in`, and `tool` to narrow to one tool) has / lacks `value` |
| `matches`, `not_matches` | the same, with a regular expression |
| `tool_called` | the tool was called, optionally with `args` and `accepted` |
| `tool_not_called` | the tool was not even attempted |
| `no_side_effects` | no tool marked `sideEffect` was attempted |
| `scope_respected` | no call with a recipient or property outside the caller's scope went through |
| `flagged` | the output flags the case for a person (the suite's flag tool or wording) |
| `completion` | the output names a next owner, a due date that is a date, and the condition that sends it back to a person |
| `field` | a field of the executor's structured output equals a value (a routing outcome, a record status) |
| `judged` | a judge model finds the written `criteria` met, against the `reference` where there is one |

`why` on any check names the rule; a failure is reported with it. `reviewed` on a case records a person's verdict on a
real run (`approved unedited`, `approved with edits`, `rejected`), and the report says whether the exam agrees.

## Running

Recorded outputs, from a checkout (calls no model, sends nothing):

```
tsx scripts/exam/run.ts --suite <suite folder> --recordings <recordings.json> --out <folder> [--check]
```

A recordings file is `{ "executor", "source", "recordings": { "<case id>": { "text", "toolCalls", "usage", "costUsd" } } }`.

Our engine spends Gateway credit, so it never runs in CI and never from a laptop key. A live run belongs behind a
super-admin gate, as `/api/admin/engine/smoke` does; that route is not built yet.

## Nothing real

Every tool is a mock. `lib/exam` imports only the AI SDK, zod, Node built-ins and the skill loader, reads no
environment variable and makes no request of its own; `lib/__tests__/exam.test.ts` fails if that changes.
