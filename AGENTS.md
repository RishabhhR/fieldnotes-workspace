<!-- coordo:start -->
## Multi-Agent Coordination (coordo)
This project is coordinated with Claude Code via a shared ledger at `.coordo/ledger.md`.
At the start of a session:
1. Run `coordo status` — leads with any open decisions blocking work.
2. Run `coordo digest --as antigravity` — shows what changed since you last checked.
Read or edit `.coordo/ledger.md` directly, or use `coordo task` / `coordo decision`.

**Development Protocol (Ledger-First Always):**
1. **Before writing any code**, add a task (`coordo task add "..."`) claiming the feature/fix and declaring file scope.
2. Commit the ledger claim to git **before** starting code changes.
3. Do the work and commit code referencing the task ID (e.g., `git commit -m "feat: TASK-001 ..."`).
4. Mark task done: `coordo task done TASK-001 --note "..."` describing changes and test verification.
5. Record checkpoint before ending turn: `coordo checkpoint --as antigravity`.

Default Role Split:
- **Antigravity**: Primary feature development & implementation worker.
- **Claude**: Verification, code review, testing, and deployment gate.
<!-- coordo:end -->
