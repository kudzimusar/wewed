# Prospect access setup

Wewed dashboard access uses three records with separate responsibilities:

1. `auth.users` — Supabase Auth identity and password.
2. `public."User"` — dashboard role and couple assignment.
3. `public."UserProfile"` — display profile linked to the Supabase user UUID.

Public signup is disabled. Create or invite the account in Supabase Authentication first, then run the assignment SQL below in the Supabase SQL Editor.

## Assign an owner or administrator

Replace the email and display name. Do not put a password in SQL.

```sql
with selected_auth_user as (
  select id::text as id, lower(email) as email
  from auth.users
  where lower(email) = lower('OWNER_EMAIL@example.com')
), flagship_couple as (
  select c.id
  from public."Couple" c
  join public."Wedding" w on w."coupleId" = c.id
  where w.slug = 'charity-and-kudzie'
  limit 1
)
insert into public."User" (
  id,
  email,
  name,
  role,
  "coupleId",
  "isActive",
  "createdAt",
  "updatedAt"
)
select
  a.id,
  a.email,
  'OWNER DISPLAY NAME',
  'admin',
  c.id,
  true,
  now(),
  now()
from selected_auth_user a
cross join flagship_couple c
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  "coupleId" = excluded."coupleId",
  "isActive" = true,
  "updatedAt" = now();

insert into public."UserProfile" (
  id,
  email,
  "displayName",
  role,
  "createdAt",
  "updatedAt"
)
select
  id::text,
  lower(email),
  'OWNER DISPLAY NAME',
  'admin',
  now(),
  now()
from auth.users
where lower(email) = lower('OWNER_EMAIL@example.com')
on conflict (id) do update
set
  email = excluded.email,
  "displayName" = excluded."displayName",
  role = excluded.role,
  "isBanned" = false,
  "updatedAt" = now();
```

## Assign a prospect tester

Use role `planner` for a tester who may edit the shared demo planning data. Use role `couple` only for trusted full-access testers.

```sql
with selected_auth_user as (
  select id::text as id, lower(email) as email
  from auth.users
  where lower(email) = lower('PROSPECT_EMAIL@example.com')
), flagship_couple as (
  select c.id
  from public."Couple" c
  join public."Wedding" w on w."coupleId" = c.id
  where w.slug = 'charity-and-kudzie'
  limit 1
)
insert into public."User" (
  id,
  email,
  name,
  role,
  "coupleId",
  "isActive",
  "createdAt",
  "updatedAt"
)
select
  a.id,
  a.email,
  'PROSPECT DISPLAY NAME',
  'planner',
  c.id,
  true,
  now(),
  now()
from selected_auth_user a
cross join flagship_couple c
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  "coupleId" = excluded."coupleId",
  "isActive" = true,
  "updatedAt" = now();

insert into public."UserProfile" (
  id,
  email,
  "displayName",
  role,
  "createdAt",
  "updatedAt"
)
select
  id::text,
  lower(email),
  'PROSPECT DISPLAY NAME',
  'planner',
  now(),
  now()
from auth.users
where lower(email) = lower('PROSPECT_EMAIL@example.com')
on conflict (id) do update
set
  email = excluded.email,
  "displayName" = excluded."displayName",
  role = excluded.role,
  "isBanned" = false,
  "updatedAt" = now();
```

## Disable access

```sql
update public."User"
set "isActive" = false, "updatedAt" = now()
where lower(email) = lower('USER_EMAIL@example.com');

update public."UserProfile"
set "isBanned" = true, "bannedAt" = now(), "updatedAt" = now()
where lower(email) = lower('USER_EMAIL@example.com');
```

## Demo-data warning

All prospect accounts currently use the same Charity & Kudzie demonstration wedding. Testers can see and modify the same demo planning records. Do not enter real client, payment, identity, or confidential wedding data in this shared environment.
