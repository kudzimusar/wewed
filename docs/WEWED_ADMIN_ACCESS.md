# Wewed Company Administrator Access

The parent-company console is available at `/admin` after the feature is deployed.

A Wewed administrator must use a separate Supabase authentication identity. Do not convert a planner, couple, venue, or vendor login into the platform administrator.

## First administrator

The first separate Wewed company administrator identity was provisioned and validated on July 30, 2026. Its credentials are intentionally not stored in this repository.

## Provision another administrator

Set the existing project environment variables plus the new administrator values:

```bash
export NEXT_PUBLIC_SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
export DATABASE_URL="..."
export DIRECT_URL="..."
export WEWED_ADMIN_EMAIL="admin@example.com"
export WEWED_ADMIN_PASSWORD="use-a-unique-password-of-at-least-12-characters"
export WEWED_ADMIN_NAME="Wewed Administrator"

bun scripts/provision-wewed-admin.ts
```

The script:

- creates or updates the Supabase Auth identity;
- creates or updates the application `User` with role `admin`;
- aligns the `UserProfile` record;
- attaches the user to the Wewed internal business account as `wewed_super_admin`;
- writes an audit record.

The password is read only from the process environment and is never printed or stored in the application database.

## Sign in

1. Open `/admin` on the deployed Wewed domain.
2. Enter the provisioned email and password.
3. The server validates both the signed session and the active application `admin` role.

Planner and couple users may authenticate through the same sign-in screen, but the `/api/admin` authorization layer rejects all non-admin roles.

## Removal or suspension

To block access immediately, set the application `User.isActive` field to `false` or disable the Supabase Auth identity. The server checks active admin status on every parent-company API request.
