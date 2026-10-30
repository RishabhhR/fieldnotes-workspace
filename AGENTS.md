<!-- coordo:start -->
## Multi-Agent Coordination (coordo)
This project uses the private Mongo-backed Coordo ledger selected in `.coordo/config.json` (`ledgerId: personal`). Mongo is the canonical source for tasks, decisions, and completion notes; `.coordo/ledger.md` is a read-only historical archive.
At the start of a session:
1. Run `coordo status --as <your-agent-name>` and `coordo task list --status open --as <your-agent-name>`.
2. Run `coordo digest --as <your-agent-name>` to review repository changes since your last checkpoint.
3. Use `coordo task` and `coordo decision` with explicit `--as`, `--from`, and `--to` identities for all coordination writes. Never edit `.coordo/ledger.md` directly.
4. If Mongo is unavailable or authentication fails, stop and report the connection problem; never fall back to Git-ledger writes. Credentials belong only in `~/.config/coordo/mongo.env`; never print, commit, or copy them.

**Development Protocol (Ledger-First Always):**
1. **Before writing any code**, add a Mongo task (`coordo task add "..." --from <your-agent-name> --to <owner> --as <your-agent-name>`) describing the scope and files.
2. The Mongo task is the claim; do not commit coordination entries to Git.
3. Do the work and commit code referencing the task ID (e.g., `git commit -m "feat: TASK-001 ..."`).
4. Mark task done: `coordo task done <task-id> --note "..." --as <your-agent-name>` describing changes and test verification.
5. Record checkpoint before ending turn: `coordo checkpoint --as <your-agent-name>`.

Default Role Split:
- **Antigravity**: Primary feature development & implementation worker.
- **Claude**: Verification, code review, testing, and deployment gate.
- Explicit `to:` assignments in Mongo tasks take precedence over this default split.
<!-- coordo:end -->
