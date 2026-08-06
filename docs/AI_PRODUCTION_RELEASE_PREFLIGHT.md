# AI Production Release Preflight

This release candidate is validated only after current `main` is merged into `feature/ai-provider-router` and every exact-head release gate passes.

## Targeted release remediations

- AI response copying uses the modern Clipboard API with a browser fallback and visible success/failure feedback.
- Planner task due states are calculated deterministically on the server from the UTC context timestamp.
- Planner Copilot is instructed to use the server-provided `due_state` rather than recalculate relative dates.
- Unit coverage verifies future, overdue, due-today, due-tomorrow, completed, and undated task states.

## Promotion conditions

- All exact-head GitHub workflows pass.
- The exact-head Vercel Preview is Ready.
- Preview AI health confirms Z.AI with `glm-4.7-flash` and private fallback disabled.
- Production AI environment variables are configured before merge.
- Production deployment health and runtime logs are checked after promotion.
