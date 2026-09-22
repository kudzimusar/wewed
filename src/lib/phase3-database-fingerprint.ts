import 'server-only'

export const EXPECTED_WEWED_SUPABASE_REF = 'kjigkhjdeymukwradoqu'

export interface SafeDatabaseFingerprint {
  available: boolean
  protocol: 'postgresql' | 'postgres' | null
  host: string | null
  database: string | null
  connectionUsername: string | null
  applicationRoleHint: string | null
  projectRef: string | null
  projectRefSource: 'username' | 'host' | null
  matchesExpectedProject: boolean
  parseError: boolean
}

const SUPABASE_REF = /^[a-z0-9]{20}$/

function fromUsername(username: string): string | null {
  const parts = username.split('.')
  const candidate = parts.at(-1) ?? ''
  return SUPABASE_REF.test(candidate) ? candidate : null
}

function fromHost(host: string): string | null {
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(host)
  return direct?.[1]?.toLowerCase() ?? null
}

/**
 * Parse DATABASE_URL without ever returning the password, query string, or full URL.
 *
 * Supabase pooler URLs normally carry the project ref in the username
 * (postgres.<project-ref>) while direct database hosts carry it in
 * db.<project-ref>.supabase.co. If neither form is present we fail closed.
 */
export function fingerprintDatabaseUrl(raw: string | undefined): SafeDatabaseFingerprint {
  if (!raw?.trim()) {
    return {
      available: false,
      protocol: null,
      host: null,
      database: null,
      connectionUsername: null,
      applicationRoleHint: null,
      projectRef: null,
      projectRefSource: null,
      matchesExpectedProject: false,
      parseError: false,
    }
  }

  try {
    const parsed = new URL(raw)
    const protocol =
      parsed.protocol === 'postgresql:'
        ? 'postgresql'
        : parsed.protocol === 'postgres:'
          ? 'postgres'
          : null

    if (!protocol) {
      return {
        available: true,
        protocol: null,
        host: null,
        database: null,
        connectionUsername: null,
        applicationRoleHint: null,
        projectRef: null,
        projectRefSource: null,
        matchesExpectedProject: false,
        parseError: true,
      }
    }

    const connectionUsername = decodeURIComponent(parsed.username)
    const host = parsed.hostname.toLowerCase()
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || null
    const usernameRef = fromUsername(connectionUsername)
    const hostRef = fromHost(host)
    const projectRef = usernameRef ?? hostRef
    const projectRefSource = usernameRef ? 'username' : hostRef ? 'host' : null
    const applicationRoleHint = connectionUsername.includes('.')
      ? connectionUsername.slice(0, connectionUsername.indexOf('.')) || null
      : connectionUsername || null

    return {
      available: true,
      protocol,
      host,
      database,
      connectionUsername: connectionUsername || null,
      applicationRoleHint,
      projectRef,
      projectRefSource,
      matchesExpectedProject: projectRef === EXPECTED_WEWED_SUPABASE_REF,
      parseError: false,
    }
  } catch {
    return {
      available: true,
      protocol: null,
      host: null,
      database: null,
      connectionUsername: null,
      applicationRoleHint: null,
      projectRef: null,
      projectRefSource: null,
      matchesExpectedProject: false,
      parseError: true,
    }
  }
}
