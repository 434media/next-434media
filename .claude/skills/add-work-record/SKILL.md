---
name: add-work-record
description: Runs the procedure that turns a new piece of 434 MEDIA work into a published Work page record — intake questions to the founder in one batch, the system-of-record seed row, media, regeneration, verification and pull requests in both repositories. Use when asked to add or put up a new piece of work, create a new Work page record, add [title] to the Work page, or publish a film, event or platform as portfolio work. Not for editing the Work page component or its styling.
---

# Add a Work page record

The procedure is canonical in the private context repository and is **not
restated here**:

```
docs/context/"06 Standards/Work_Record_SOP.md"
```

This skill drives that SOP. It names no field values, sizes, budgets or
vocabularies of its own — every one of those lives in a governing document read
through `docs/context`, so nothing here can drift from them. This repository is
public: never write a record's internal facts (ownership, stakes, terms,
restrictions, internal context) into this file, a commit message, a pull request
body or any file in this repository. They go into the seed in 434-context only.

## Before anything

1. `date`, and read `CLAUDE.md` here and `docs/context/CLAUDE.md`. Both bind.
2. If `docs/context` is missing or empty, stop and report it — never fall back
   to another copy.
3. Read the SOP in full, then every source its header names: the master (report
   its version line before relying on it), the Display and Design Standard,
   `docs/context/"05 System of Record"/schemas/portfolio_record.schema.json`.
   Use the versions you read; if the SOP's stated versions differ, say so and
   follow the governing documents.
4. Confirm you are the one designated writer for this record (master 11.4). If
   another session holds the seed, the master or the generated `lib/` files,
   report the conflict rather than writing alongside it.

## Intake — one batch, then wait

Take the questionnaire at the end of the SOP. Pre-fill what the request already
states, mark those for confirmation, and send the rest **as one list**. Do not
ask in rounds. "Don't know yet" is an acceptable answer: the field stays empty
and the record is held or waits — it is never guessed. Credits, ownership and
the public description are never inferred (master 4.6).

If you are a sub-session, the questions go to your coordinator, not the founder.

Stop here until the answers come back.

## The motion

Follow the SOP's steps in order, recording each in the run log. Points that
are easy to get wrong:

- **Record key** is permanent once written. Propose it; write it only after the
  founder confirms it.
- **Public text** — the approved description, the 434 MEDIA role, the rights
  defaults — is public. Show it to the founder word for word for approval; it
  never carries ownership structure.
- **The master does not change to add a record.** It changes only when the
  record needs something the 4.5 vocabulary lacks; that is a master edit, done
  as one motion (`docs/context/CLAUDE.md`), and its own decision for the founder.
- **Work in worktrees.** A branch in a 434-context worktree for the seed, the
  skill bundles and the run log; a branch here for the generated files. Never
  switch branches in a shared checkout.
- **Generated files are never hand-edited** — `lib/work-records.ts`,
  `lib/work-media.ts`, `lib/master-manifest.json`. Regenerate them with the
  commands the SOP names, pointing `docs/context` (a gitignored symlink) at the
  434-context worktree you wrote the seed in.
- **Verification is the rendered page**, not a passing build: the SOP's step 10
  checks plus the record on the pull request's preview at desktop and phone
  width. Preview sign-in is the email/password form, per preview URL.
- **Media** follows the SOP's step 8 pipeline. Never install a tool to run it;
  ffmpeg is reached through `imageio_ffmpeg` (see `CLAUDE.md`, Environment).

## Finish

- A pull request in each repository, linked to each other. **Do not merge.**
  Before any merge, write the founder a short summary of the change and its
  evidence and wait for his go-ahead (`CLAUDE.md`).
- The run log and a process-log entry name the writer and the system. If the
  process log or register is held by another session, leave the entry out and
  say so.
- Report what is not done — media not yet supplied, a field left empty, a
  record held unpublished — plainly, with the reason.
