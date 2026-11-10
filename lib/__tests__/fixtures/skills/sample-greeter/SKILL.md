---
name: sample-greeter
description: An invented skill for the loader's tests. Greets a visitor by name using the greeting rules in its reference file. Use when a test needs a skill to run.
license: Apache-2.0
metadata:
  owner: Test Owner
  version: "0.1.0"
allowed-tools: lookup_visitor
---

# Sample greeter

1. Read `references/rules.md` with read_skill_file.
2. Look the visitor up with lookup_visitor.
3. Greet them as the rules say, in one line.
