<!-- coordo:start -->
## Multi-Agent Coordination (coordo)
This project is coordinated with Google Antigravity via a shared ledger at `.coordo/ledger.md`.
At the start of a session:
1. Run `coordo status` — check open decisions/tasks.
2. Run `coordo digest --as claude` — view recent commits and changes.

Development Protocol:
1. Claim tasks prior to editing code.
2. Verify Antigravity's completed tasks, run tests, and validate deployments.
3. Record checkpoint before ending: `coordo checkpoint --as claude`.
<!-- coordo:end -->
