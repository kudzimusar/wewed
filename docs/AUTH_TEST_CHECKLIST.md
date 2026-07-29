# Authentication test checklist

- Unauthenticated `/api/planner/tasks` returns 401.
- Unauthenticated `GET /api/rsvp` returns 401.
- Public `POST /api/rsvp` remains available.
- Public guest RSVP token GET/PUT remains available.
- Unauthenticated RSVP token PATCH check-in returns 401.
- Public guest AI chat remains available.
- Couple AI chat, speech, and summary require a signed dashboard session.
- Invalid credentials do not create a dashboard session.
- Valid Supabase credentials without an active `User` assignment return 403.
- Banned profiles return 403.
- Planner/couple users assigned to another couple return 403.
- Signout clears Supabase and application sessions.
