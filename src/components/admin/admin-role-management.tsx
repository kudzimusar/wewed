'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  WEWED_ADMIN_ROLES,
  WEWED_ADMIN_ROLE_LABELS,
  type WewedAdminRole,
} from '@/lib/wewed-admin-policy'

type Member = {
  membershipId: string
  userId: string
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: string | null
  role: string
  status: string
  alternateEmails: unknown
  phone: string | null
  city: string | null
  stateProvince: string | null
  country: string | null
  certificates: unknown
  invitationStatus: string | null
  invitationSentAt: string | null
  invitationAcceptedAt: string | null
  profileCompletedAt: string | null
}

type Payload = {
  success: boolean
  error?: string
  admin: { email: string; role: string; permissions: string[] }
  members: Member[]
}

type ActionPayload = {
  success?: boolean
  error?: string
  invitationSent?: boolean
  invitationKind?: 'invite' | 'recovery'
}

function date(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

function values(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function splitEntries(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function statusTone(status: string): string {
  if (status === 'active') {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
  }
  if (status === 'invited') {
    return 'border-gold/30 bg-gold/10 text-gold-light'
  }
  return 'border-rose-300/30 bg-rose-300/10 text-rose-100'
}

export function AdminRoleManagement() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<WewedAdminRole>(
    'wewed_operations_admin',
  )
  const [phone, setPhone] = useState('')
  const [alternateEmails, setAlternateEmails] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [certificates, setCertificates] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/roles', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as Payload
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load administrator invitations.')
      }
      setData(payload)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load administrator invitations.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    setNotice(null)

    const normalizedEmail = email.trim().toLowerCase()
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_admin_member',
          email: normalizedEmail,
          fullName,
          role,
          phone,
          alternateEmails: splitEntries(alternateEmails),
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          postalCode,
          country,
          certificates: splitEntries(certificates),
        }),
      })
      const payload = (await response.json()) as ActionPayload
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to send the invitation.')
      }

      setNotice(
        payload.invitationKind === 'recovery'
          ? `${normalizedEmail} received a secure account-setup email.`
          : `${normalizedEmail} received a secure administrator invitation.`,
      )
      setEmail('')
      setFullName('')
      setRole('wewed_operations_admin')
      setPhone('')
      setAlternateEmails('')
      setAddressLine1('')
      setAddressLine2('')
      setCity('')
      setStateProvince('')
      setPostalCode('')
      setCountry('')
      setCertificates('')
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to send the invitation.',
      )
    } finally {
      setWorking(false)
    }
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso text-gold">
        <Loader2 className="size-8 animate-spin" />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne">
        <Card className="max-w-lg border-rose-300/25 bg-white/[0.04] text-champagne">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-gold" />
            <h1 className="mt-4 text-2xl font-semibold">
              Administrator invitations unavailable
            </h1>
            <p className="mt-3 text-sm text-champagne/60">{error}</p>
            <Button
              onClick={() => void load()}
              className="mt-6 bg-gold text-espresso hover:bg-gold-light"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-espresso px-5 py-24 text-champagne lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">
              Super Admin · secure onboarding
            </p>
            <h1 className="mt-2 text-4xl font-semibold">
              Invite platform administrator
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/55">
              This screen creates a named invitation and professional profile only.
              Role, lifecycle, and account-scope changes are intentionally handled
              in the governed Platform administrators workspace, where a reason and
              all lockout safeguards are required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-gold/25 text-gold hover:bg-gold/10"
            >
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                Governance console
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading || working}
              className="border-gold/25 text-gold hover:bg-gold/10"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="size-4" />
            {notice}
          </div>
        )}

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader>
            <CardTitle className="text-lg">New administrator profile</CardTitle>
            <p className="text-sm leading-6 text-champagne/50">
              The recipient must open the secure email, choose a password, confirm
              the profile, and explicitly accept before access becomes active.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_240px]">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-champagne/55">
                    Primary email
                  </span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="administrator@example.com"
                    required
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-champagne/55">
                    Full name
                  </span>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Full legal or professional name"
                    required
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-champagne/55">
                    Initial platform role
                  </span>
                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as WewedAdminRole)
                    }
                    disabled={working}
                    className="h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
                  >
                    {WEWED_ADMIN_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {WEWED_ADMIN_ROLE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <details
                className="rounded-xl border border-gold/15 bg-black/10 p-4"
                open
              >
                <summary className="cursor-pointer text-sm font-semibold text-gold">
                  Contact, address, and credentials
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Input
                    value={alternateEmails}
                    onChange={(event) => setAlternateEmails(event.target.value)}
                    placeholder="Alternate emails, comma separated"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Input
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    placeholder="Address line 1"
                    disabled={working}
                    className="border-gold/20 bg-black/15 md:col-span-2"
                  />
                  <Input
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                    placeholder="Address line 2"
                    disabled={working}
                    className="border-gold/20 bg-black/15 md:col-span-2"
                  />
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="City"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Input
                    value={stateProvince}
                    onChange={(event) => setStateProvince(event.target.value)}
                    placeholder="State / province"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Input
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    placeholder="Postal code"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder="Country"
                    disabled={working}
                    className="border-gold/20 bg-black/15"
                  />
                  <Textarea
                    value={certificates}
                    onChange={(event) => setCertificates(event.target.value)}
                    placeholder="One certificate or professional credential per line"
                    disabled={working}
                    className="min-h-28 border-gold/20 bg-black/15 md:col-span-2"
                  />
                </div>
              </details>

              <Button
                type="submit"
                disabled={working || !email.trim() || !fullName.trim()}
                className="bg-gold text-espresso hover:bg-gold-light"
              >
                {working ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Send secure invitation
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-gold/15 bg-white/[0.03] text-champagne">
          <CardHeader>
            <CardTitle className="text-lg">Invitation registry</CardTitle>
            <p className="text-sm text-champagne/50">
              Read-only here. Use Platform administrators in the governance console
              for role, status, and scope changes.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.members.map((member) => {
              const credentials = values(member.certificates)
              const alternates = values(member.alternateEmails)
              const effective =
                member.status === 'invited'
                  ? 'invited'
                  : member.status === 'active' && member.userActive
                    ? 'active'
                    : member.status === 'revoked'
                      ? 'revoked'
                      : 'suspended'

              return (
                <div
                  key={member.membershipId}
                  className="rounded-xl border border-gold/12 bg-black/10 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {member.name || member.email}
                        </p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusTone(effective)}`}
                        >
                          {effective}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-champagne/40">
                        {member.email}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-champagne/50">
                        {WEWED_ADMIN_ROLE_LABELS[
                          member.role as WewedAdminRole
                        ] || member.role}
                        {' · '}
                        {member.phone || 'No phone'}
                        {' · '}
                        {[member.city, member.stateProvince, member.country]
                          .filter(Boolean)
                          .join(', ') || 'No address'}
                      </p>
                      <p className="text-xs text-champagne/40">
                        {alternates.length} alternate email
                        {alternates.length === 1 ? '' : 's'} ·{' '}
                        {credentials.length} credential
                        {credentials.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="grid min-w-[280px] gap-1 text-xs text-champagne/45 sm:grid-cols-2 lg:text-right">
                      <span>Invitation sent</span>
                      <strong className="font-medium text-champagne/65">
                        {date(member.invitationSentAt)}
                      </strong>
                      <span>Accepted</span>
                      <strong className="font-medium text-champagne/65">
                        {date(member.invitationAcceptedAt)}
                      </strong>
                      <span>Profile</span>
                      <strong className="font-medium text-champagne/65">
                        {member.profileCompletedAt ? 'Complete' : 'Pending'}
                      </strong>
                      <span>Last login</span>
                      <strong className="font-medium text-champagne/65">
                        {date(member.lastLoginAt)}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
