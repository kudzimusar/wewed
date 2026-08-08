import {
  POLICY_EFFECTIVE_DATE,
  PUBLIC_DOCUMENTS as BASE_PUBLIC_DOCUMENTS,
  WEWED_DOMAIN,
  type PublicDocument as BasePublicDocument,
  type PublicDocumentSection as BasePublicDocumentSection,
} from '@/lib/public-documents'

export { POLICY_EFFECTIVE_DATE, WEWED_DOMAIN }

export type PublicDocumentCategory =
  | 'company'
  | 'trust'
  | 'legal'
  | 'vendors'
  | 'developers'
  | 'help'

export interface PublicDocumentLink {
  label: string
  href: string
}

export interface PublicDocumentSection extends BasePublicDocumentSection {
  links?: PublicDocumentLink[]
}

export interface PublicDocument {
  category: PublicDocumentCategory
  slug: string
  title: string
  summary: string
  effectiveDate?: string
  status?: 'Effective' | 'Operational guidance' | 'Public information' | 'Help guide' | 'API preview'
  sections: PublicDocumentSection[]
}

function baseDocument(category: BasePublicDocument['category'], slug: string): BasePublicDocument {
  const document = BASE_PUBLIC_DOCUMENTS.find((item) => item.category === category && item.slug === slug)
  if (!document) throw new Error(`Missing base public document: ${category}/${slug}`)
  return document
}

function cloneDocument(
  source: BasePublicDocument,
  overrides: Partial<PublicDocument> & Pick<PublicDocument, 'category' | 'slug'>,
): PublicDocument {
  return {
    ...source,
    ...overrides,
    sections: overrides.sections ?? source.sections,
  }
}

const publicInfo = (
  category: Extract<PublicDocumentCategory, 'company' | 'vendors'>,
  slug: string,
  title: string,
  summary: string,
  sections: PublicDocumentSection[],
): PublicDocument => ({ category, slug, title, summary, status: 'Public information', sections })

const help = (
  slug: string,
  title: string,
  summary: string,
  sections: PublicDocumentSection[],
): PublicDocument => ({ category: 'help', slug, title, summary, status: 'Help guide', sections })

const developer = (
  slug: string,
  title: string,
  summary: string,
  sections: PublicDocumentSection[],
): PublicDocument => ({ category: 'developers', slug, title, summary, status: 'API preview', sections })

const companyDocuments: PublicDocument[] = [
  publicInfo('company', 'about', 'About Wewed', 'What Wewed is, who it serves and the product principles behind wewed.pro.', [
    {
      heading: 'Wedding infrastructure for everyone involved',
      paragraphs: [
        'Wewed is wedding-planning technology for couples, professional planners, wedding-service providers and invited guests. The platform brings private wedding spaces, planning operations, professional discovery and event participation into one connected product.',
        'The official public domain is wewed.pro. Product, policy and trust information published through this domain should be treated as the canonical public Wewed experience unless Wewed expressly identifies another official service.',
      ],
    },
    {
      heading: 'What we are building around',
      bullets: [
        'Private-by-context wedding collaboration.',
        'Professional planning workflows for real wedding operations.',
        'Transparent marketplace rules for planners, venues and vendors.',
        'Clear permissions for guest, couple, planner and provider information.',
        'Human accountability around payments, contracts and AI-assisted decisions.',
        'Public policies that evolve with the product rather than remaining disconnected legal boilerplate.',
      ],
    },
    {
      heading: 'Platform role',
      paragraphs: [
        'Wewed provides software and marketplace infrastructure. Independent planners, venues and vendors remain responsible for the services they offer unless a specific Wewed product or agreement expressly states a different role.',
      ],
      links: [
        { label: 'How Wewed works', href: '/company/how-wewed-works' },
        { label: 'Trust & Safety', href: '/trust' },
      ],
    },
  ]),
  publicInfo('company', 'how-wewed-works', 'How Wewed Works', 'How couples, planners, vendors and guests use Wewed together without losing control of roles or information.', [
    {
      heading: 'Couples',
      paragraphs: ['Couples can create or participate in a wedding workspace, manage wedding information, coordinate planning, work with professionals and control what is shared with invited participants.'],
      links: [{ label: 'Couples help', href: '/help/couples' }],
    },
    {
      heading: 'Planners',
      paragraphs: ['Professional planners can use Wewed as an operational workspace for wedding tasks, budgets, timelines, guests, vendors, templates, collaboration and event execution, subject to the permissions granted for each wedding.'],
      links: [{ label: 'Planners help', href: '/help/planners' }],
    },
    {
      heading: 'Vendors and venues',
      paragraphs: ['Wedding providers can appear in the marketplace, manage professional information and participate in wedding-service relationships. Marketplace visibility does not make an independent provider an employee or agent of Wewed.'],
      links: [
        { label: 'Browse vendors', href: '/vendors' },
        { label: 'Vendor resources', href: '/vendors/resources' },
      ],
    },
    {
      heading: 'Guests',
      paragraphs: ['Invited guests can interact with wedding experiences made available to them, including invitation or RSVP-related workflows and permitted contributions. Access to one wedding does not create access to another wedding or to private planner operations.'],
      links: [{ label: 'Guests help', href: '/help/guests' }],
    },
    {
      heading: 'The important boundary',
      paragraphs: ['Wewed coordinates information and workflows; it does not silently make high-impact decisions for a user. Vendor contracts, material payments, legal commitments and critical wedding-day changes should remain subject to deliberate action by an authorized person.'],
    },
  ]),
  publicInfo('company', 'contact', 'Contact Wewed', 'Where to go for product support, trust and safety reports, account access and business questions.', [
    {
      heading: 'Product and account support',
      paragraphs: ['For account-specific questions, use the authenticated Wewed experience when possible so the relevant wedding or account context can be identified without publishing private information.'],
      links: [
        { label: 'Sign in', href: '/sign-in' },
        { label: 'Help Center', href: '/help' },
      ],
    },
    {
      heading: 'Safety, fraud or policy concerns',
      paragraphs: ['Use the Report a Problem guidance for suspected scams, impersonation, review abuse, privacy concerns, unsafe conduct or other platform-integrity issues. Do not include unrelated guest or customer information in a report.'],
      links: [{ label: 'Report a problem', href: '/trust/report-a-problem' }],
    },
    {
      heading: 'Official communications',
      paragraphs: ['Wewed will not need your password or one-time authentication code to handle a normal support request. Verify that public policy and company information is being accessed through wewed.pro before relying on it. Dedicated legal, privacy and corporate contact details should be published here once formally designated by the Wewed operating entity.'],
    },
  ]),
  publicInfo('company', 'careers', 'Careers at Wewed', 'How Wewed will publish legitimate opportunities as the team grows.', [
    {
      heading: 'Official openings',
      paragraphs: ['When Wewed has public roles available, official openings should be published through wewed.pro or another channel explicitly linked from this page. The absence of a listed role means Wewed is not publicly advertising that position here.'],
    },
    {
      heading: 'Hiring safety',
      bullets: [
        'Wewed should never require a candidate to pay an application or interview fee.',
        'Candidates should verify that recruiting links trace back to an official Wewed channel.',
        'Sensitive identity or banking information should not be requested before it is legitimately needed for an employment process.',
        'Suspected recruiting impersonation should be reported through Wewed’s trust and safety channel.',
      ],
      links: [{ label: 'Report impersonation or fraud', href: '/trust/report-a-problem' }],
    },
    {
      heading: 'Fair opportunity',
      paragraphs: ['Recruiting and employment decisions should follow applicable employment and non-discrimination law. Wewed’s marketplace Non-Discrimination guidance does not replace jurisdiction-specific employment obligations.'],
      links: [{ label: 'Non-Discrimination', href: '/trust/non-discrimination' }],
    },
  ]),
]

const trustDocuments: PublicDocument[] = [
  cloneDocument(baseDocument('trust', 'trust-at-wewed'), { category: 'trust', slug: 'trust-at-wewed' }),
  cloneDocument(baseDocument('trust', 'verification'), {
    category: 'trust',
    slug: 'vendor-verification',
    title: 'Vendor Verification',
    summary: 'What a Wewed verification signal can mean, what it does not mean and how verification should remain auditable.',
  }),
  cloneDocument(baseDocument('trust', 'review-integrity'), { category: 'trust', slug: 'review-integrity' }),
  cloneDocument(baseDocument('trust', 'marketplace-safety'), {
    category: 'trust',
    slug: 'wedding-safety',
    title: 'Wedding Safety',
    summary: 'Practical safeguards for couples, planners, guests and providers before and during a wedding-service relationship.',
  }),
  cloneDocument(baseDocument('trust', 'scam-prevention'), { category: 'trust', slug: 'scam-prevention' }),
  cloneDocument(baseDocument('trust', 'reporting'), {
    category: 'trust',
    slug: 'report-a-problem',
    title: 'Report a Problem',
    summary: 'How to raise safety, fraud, privacy, review, content or marketplace-integrity concerns and what information helps Wewed evaluate them.',
  }),
  cloneDocument(baseDocument('legal', 'nondiscrimination'), {
    category: 'trust',
    slug: 'non-discrimination',
    title: 'Non-Discrimination',
    status: 'Operational guidance',
    effectiveDate: POLICY_EFFECTIVE_DATE,
  }),
  cloneDocument(baseDocument('trust', 'accessibility'), { category: 'trust', slug: 'accessibility' }),
  cloneDocument(baseDocument('trust', 'security'), { category: 'trust', slug: 'security' }),
]

const legalDocuments: PublicDocument[] = BASE_PUBLIC_DOCUMENTS
  .filter((document) => document.category === 'legal')
  .map((document) => cloneDocument(document, { category: 'legal', slug: document.slug }))

const vendorDocuments: PublicDocument[] = [
  cloneDocument(baseDocument('trust', 'vendor-standards'), {
    category: 'vendors',
    slug: 'vendor-standards',
    title: 'Vendor Standards',
    status: 'Public information',
  }),
  cloneDocument(baseDocument('trust', 'ranking-transparency'), {
    category: 'vendors',
    slug: 'how-ranking-works',
    title: 'How Ranking Works',
    summary: 'The public principles Wewed uses for marketplace ordering, relevance signals and paid placement.',
    status: 'Public information',
  }),
  cloneDocument(baseDocument('trust', 'verification'), {
    category: 'vendors',
    slug: 'verification',
    title: 'Verification',
    summary: 'How provider verification should work and what vendors should expect when Wewed checks an identity, contact point or other specific attribute.',
    status: 'Public information',
  }),
  cloneDocument(baseDocument('trust', 'review-integrity'), {
    category: 'vendors',
    slug: 'reviews',
    title: 'Reviews',
    summary: 'How vendors can participate in a fair review system without buying, suppressing or manipulating genuine customer feedback.',
    status: 'Public information',
    sections: [
      ...baseDocument('trust', 'review-integrity').sections,
      {
        heading: 'Vendor review disputes',
        paragraphs: ['A vendor may report a review for a specific policy reason and provide relevant evidence. Commercial status, subscription level or disagreement with a negative opinion is not by itself a reason to remove a compliant review.'],
        links: [{ label: 'Read the Review Policy', href: '/legal/reviews' }],
      },
    ],
  }),
  publicInfo('vendors', 'vendor-help', 'Vendor Help', 'The starting point for managing a Wewed provider presence, understanding marketplace rules and protecting customer information.', [
    {
      heading: 'Manage your provider presence',
      paragraphs: ['Use the provider management area to maintain the information Wewed makes available for your business. Keep service, identity, location and portfolio information accurate and remove claims that are no longer current.'],
      links: [
        { label: 'Manage provider profile', href: '/vendors/manage' },
        { label: 'View vendor marketplace', href: '/vendors' },
      ],
    },
    {
      heading: 'Marketplace expectations',
      bullets: [
        'Use customer and guest information only for the relevant wedding or enquiry purpose.',
        'Do not fabricate reviews, bookings, availability, credentials or awards.',
        'Keep important service terms in a written agreement with the customer.',
        'Do not imply a Wewed verification badge guarantees service quality or future performance.',
        'Report suspected impersonation, review manipulation or account compromise promptly.',
      ],
      links: [
        { label: 'Vendor Terms', href: '/legal/vendor-terms' },
        { label: 'Vendor Standards', href: '/vendors/resources/vendor-standards' },
      ],
    },
    {
      heading: 'Need more help?',
      links: [
        { label: 'Vendor Help Center', href: '/help/vendors' },
        { label: 'Report a problem', href: '/trust/report-a-problem' },
      ],
    },
  ]),
]

const developerDocuments: PublicDocument[] = [
  developer('overview', 'Overview', 'The current status, boundaries and publication standard for supported Wewed integrations.', [
    {
      heading: 'Current API status',
      paragraphs: ['Wewed has internal application endpoints that power the product. They are not a generally available third-party API contract. External developers should not build against undocumented internal routes or assume those routes will remain stable.'],
    },
    {
      heading: 'What public API readiness means',
      bullets: ['Documented authentication and scopes.', 'Stable resource definitions.', 'Consistent errors and pagination.', 'Published rate limits.', 'Retry-safe write behavior where needed.', 'Signed webhooks.', 'Versioning and deprecation policy.', 'Changelog and API status communication.', 'Developer Terms accepted before production access.'],
    },
  ]),
  developer('quickstart', 'Quickstart', 'The supported onboarding flow Wewed will use when third-party API credentials are issued.', [
    {
      heading: 'Availability',
      paragraphs: ['Public third-party credentials are not generally available yet. This Quickstart defines the sequence Wewed intends to support rather than exposing internal product routes.'],
    },
    {
      heading: 'Integration flow',
      bullets: ['Register or obtain approval for an integration.', 'Receive environment-specific credentials.', 'Request only required scopes.', 'Use the documented API version and base URL.', 'Handle structured errors and published rate limits.', 'Verify webhook signatures.', 'Test against non-production data before production use.'],
    },
    {
      heading: 'Before production',
      links: [
        { label: 'Authentication', href: '/developers/authentication' },
        { label: 'API Reference', href: '/developers/api-reference' },
        { label: 'Developer Terms', href: '/developers/developer-terms' },
      ],
    },
  ]),
  developer('api-reference', 'API Reference', 'The resource and protocol structure reserved for Wewed’s supported public API without exposing undocumented internal endpoints.', [
    {
      heading: 'Public endpoint availability',
      paragraphs: ['No supported public API base URL is generally available at this time. Paths used internally by wewed.pro are private application implementation details and are not part of this reference until Wewed explicitly documents them as supported.'],
    },
    {
      heading: 'Resource families',
      bullets: ['Accounts and authorized identities.', 'Wedding workspaces.', 'Wedding memberships and roles.', 'Planner organizations and teams.', 'Vendors and marketplace profiles.', 'Tasks, timelines, budgets and planning resources.', 'Guests and participation data where authorization permits.', 'Subscription metadata when relevant to the authorized account.'],
    },
    {
      heading: 'Request conventions',
      bullets: ['HTTPS only for supported production access.', 'Versioned requests once a public version is announced.', 'Structured JSON request and response bodies unless an endpoint documents another format.', 'Stable machine-readable error identifiers.', 'Pagination for collection endpoints.', 'Idempotency or equivalent retry protection for consequential write operations where documented.'],
    },
    {
      heading: 'Privacy boundary',
      paragraphs: ['API access must never turn private wedding or guest data into broadly discoverable information. A public API must preserve the same or stricter tenant, wedding, role and resource permissions as the Wewed product.'],
    },
  ]),
  developer('authentication', 'Authentication', 'How supported integrations will authenticate and remain within approved permissions.', [
    {
      heading: 'Credentials',
      paragraphs: ['API keys, OAuth credentials and webhook signing secrets must be treated as secrets, stored server-side where appropriate and rotated after suspected exposure. Privileged credentials must not be embedded in publicly distributed client code.'],
    },
    {
      heading: 'Least privilege',
      paragraphs: ['A valid credential does not override tenant, wedding, user-role or resource authorization. Integrations should receive only the scopes and wedding access required for the approved purpose.'],
    },
  ]),
  developer('webhooks', 'Webhooks', 'The delivery, signature and retry model reserved for supported Wewed event notifications.', [
    {
      heading: 'Verification',
      paragraphs: ['Webhook deliveries should be cryptographically signed using a documented method. Consumers must verify the signature before trusting a payload and must support secret rotation.'],
    },
    {
      heading: 'Delivery semantics',
      paragraphs: ['Webhook consumers should assume an event can be delayed, retried or delivered more than once. Handlers should process event identifiers idempotently and avoid treating delivery order as guaranteed unless an event type explicitly documents that behavior.'],
    },
  ]),
  developer('errors', 'Errors', 'The error contract Wewed will use so supported API clients can distinguish validation, authentication, authorization and server failures.', [
    {
      heading: 'Error shape',
      paragraphs: ['Supported APIs should use appropriate HTTP status codes together with stable machine-readable error identifiers and a safe human-readable explanation. Error bodies must not leak credentials, secrets or cross-tenant information.'],
    },
    {
      heading: 'Client behavior',
      bullets: ['Correct validation errors before retrying.', 'Refresh or replace invalid credentials rather than repeatedly retrying authentication failures.', 'Treat authorization failures as a permissions problem, not a signal to probe other resources.', 'Apply documented retry guidance only to transient failures.', 'Log request correlation identifiers when Wewed provides them.'],
    },
  ]),
  developer('rate-limits', 'Rate Limits', 'How Wewed will protect API reliability and how clients should respond when a published limit is reached.', [
    {
      heading: 'Published limits',
      paragraphs: ['Rate-limit values are not being announced before public API access exists. When a supported API launches, Wewed should publish the applicable request limits, relevant response headers or metadata and retry behavior.'],
    },
    {
      heading: 'Responsible clients',
      bullets: ['Prefer webhooks to aggressive polling where an event can be delivered.', 'Use exponential backoff or server-provided retry guidance.', 'Cache data when appropriate for the integration purpose.', 'Do not distribute work across credentials to evade a limit.', 'Request higher limits through an approved process rather than bypassing platform controls.'],
    },
  ]),
  developer('versioning', 'Versioning', 'How Wewed will protect supported integrations from unannounced breaking API changes.', [
    {
      heading: 'Stable contracts',
      paragraphs: ['Once an API is publicly documented as supported, breaking changes should be introduced through an explicit version or documented migration path rather than silently changing the meaning of an existing contract.'],
    },
    {
      heading: 'Deprecation',
      paragraphs: ['Where practical, Wewed should provide advance deprecation notice, migration guidance and a reasonable transition period. Emergency security, abuse-prevention or legal changes may require faster action.'],
    },
  ]),
  developer('changelog', 'Changelog', 'The public record for material supported API and integration changes.', [
    {
      heading: 'Current state',
      paragraphs: ['No generally available public API version has been announced. The first supported release should be recorded here with its version, release date, authentication model, material resources and any migration expectations.'],
    },
    {
      heading: 'What belongs here',
      bullets: ['New supported API versions.', 'New resources or webhook event types.', 'Breaking changes and migrations.', 'Deprecation notices.', 'Material authentication or security changes.', 'Changes to published rate-limit behavior.'],
    },
  ]),
  developer('api-status', 'API Status', 'The authoritative public availability statement for Wewed’s developer platform.', [
    {
      heading: 'Public API',
      paragraphs: ['Status: not generally available. Wewed has not announced a supported third-party production API base URL or public credential programme.'],
    },
    {
      heading: 'Internal product APIs',
      paragraphs: ['Internal endpoints used by the Wewed application are part of the product implementation and are not covered by a third-party uptime or compatibility commitment. Their existence must not be interpreted as public API availability.'],
    },
    {
      heading: 'When public access launches',
      paragraphs: ['This page should identify supported environments, current incidents, maintenance affecting developers and the status location used for production API availability.'],
    },
  ]),
  developer('developer-terms', 'Developer Terms', 'The rules that apply when Wewed expressly authorizes programmatic or integration access.', [
    {
      heading: 'No implied API licence',
      paragraphs: ['The presence of internal Wewed routes does not grant permission to scrape, automate or integrate with them. Programmatic access is authorized only through credentials, documentation or a written agreement issued for that purpose.'],
    },
    {
      heading: 'Authorized access',
      bullets: ['Use only approved credentials, scopes and endpoints.', 'Do not bypass authentication, rate limits, tenancy or authorization controls.', 'Collect and retain only data needed for the approved purpose.', 'Protect and rotate credentials after suspected exposure.', 'Do not use Wewed data for surveillance, spam, unauthorized profiling, scraping or data brokerage.'],
      links: [{ label: 'Authoritative legal Developer & API Terms', href: '/legal/developer-terms' }],
    },
  ]),
]

const helpDocuments: PublicDocument[] = [
  help('couples', 'Couples', 'Help for couples creating, planning and sharing a wedding through Wewed.', [
    {
      heading: 'Start and manage your wedding',
      bullets: ['Create or join the appropriate Wewed account and wedding workspace.', 'Keep wedding dates, venue details and core information current.', 'Use planning tools and professional collaboration according to the access you grant.', 'Review privacy settings before publishing or sharing event information.'],
      links: [
        { label: 'Create a Wewed account', href: '/register?accountType=couple' },
        { label: 'How Wewed works', href: '/company/how-wewed-works' },
      ],
    },
    {
      heading: 'Planners, vendors and payments',
      paragraphs: ['Evaluate independent providers carefully, confirm material terms in writing and distinguish Wewed subscription billing from money owed under a separate wedding-service contract.'],
      links: [
        { label: 'Find a planner', href: '/planners' },
        { label: 'Browse vendors', href: '/vendors' },
        { label: 'Payment & Refund Terms', href: '/legal/payments-refunds' },
      ],
    },
    {
      heading: 'Privacy and problems',
      paragraphs: ['Wedding workspaces may contain guest contact details, schedules, locations and other sensitive event information. Share only what is needed and report suspected fraud, impersonation or unauthorized access promptly.'],
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Report a problem', href: '/trust/report-a-problem' },
      ],
    },
  ]),
  help('planners', 'Planners', 'Help for professional planners using Wewed as a daily wedding operations workspace.', [
    {
      heading: 'Run the wedding workspace',
      bullets: ['Use tasks, priorities, due dates and assignments to manage operational work.', 'Keep budgets, vendors, guest information, seating and timeline data aligned with the wedding.', 'Use templates and imports carefully and validate the result before relying on bulk changes.', 'Review team membership when collaborators join or leave a wedding.', 'Preserve critical decisions and changes in durable records where the product supports them.'],
      links: [{ label: 'For planners', href: '/for-planners' }],
    },
    {
      heading: 'Data responsibility',
      paragraphs: ['A planner can work with information about couples, guests and vendors who may not hold their own Wewed accounts. Use that data only for the wedding purpose, limit access to people who need it and do not repurpose guest or lead details for unrelated marketing.'],
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Acceptable Use', href: '/legal/acceptable-use' },
      ],
    },
    {
      heading: 'AI-assisted work',
      paragraphs: ['AI can help draft, summarize or organize work but generated output must be reviewed before it changes deadlines, vendor commitments, budgets, contracts or wedding-day instructions.'],
      links: [{ label: 'AI Policy', href: '/legal/ai-transparency' }],
    },
  ]),
  help('vendors', 'Vendors', 'Help for venues and wedding-service providers participating in the Wewed marketplace.', [
    {
      heading: 'Your profile and marketplace presence',
      paragraphs: ['Keep your business identity, service information, location, portfolio rights and material availability claims accurate. Use Wewed verification language only for the attribute actually checked.'],
      links: [
        { label: 'Manage provider profile', href: '/vendors/manage' },
        { label: 'Vendor resources', href: '/vendors/resources' },
      ],
    },
    {
      heading: 'Customers, guests and reviews',
      paragraphs: ['Use customer information for the relevant relationship, protect guest data, keep reviews authentic and report manipulation through the appropriate process rather than attempting to suppress legitimate criticism.'],
      links: [
        { label: 'Vendor Terms', href: '/legal/vendor-terms' },
        { label: 'Reviews', href: '/vendors/resources/reviews' },
      ],
    },
    {
      heading: 'Account or safety issue',
      links: [{ label: 'Report a problem', href: '/trust/report-a-problem' }],
    },
  ]),
  help('guests', 'Guests', 'Help for invited guests accessing a wedding experience on Wewed.', [
    {
      heading: 'Access the correct wedding',
      paragraphs: ['Use the invitation or access method provided for the wedding. Guest access is tied to the intended wedding context and does not create general access to planner operations or another couple’s wedding.'],
      links: [{ label: 'Guest access help', href: '/guest-access-help' }],
    },
    {
      heading: 'RSVP and participation information',
      paragraphs: ['Provide RSVP, meal, dietary, plus-one or participation information only when it is relevant to the wedding. Couples and authorized planners may use those details to operate the event.'],
    },
    {
      heading: 'Messages, media and contributions',
      paragraphs: ['Only submit content you are entitled to share. Respect the wedding’s privacy expectations and do not expose another guest’s personal information without a legitimate reason.'],
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Content Policy', href: '/legal/content-community' },
      ],
    },
    {
      heading: 'Something looks wrong',
      paragraphs: ['Do not share passwords or one-time authentication codes with someone claiming to need them for ordinary wedding support. Report suspected impersonation, unsafe content or privacy concerns.'],
      links: [{ label: 'Report a problem', href: '/trust/report-a-problem' }],
    },
  ]),
]

export const PUBLIC_SITE_DOCUMENTS: PublicDocument[] = [
  ...companyDocuments,
  ...trustDocuments,
  ...legalDocuments,
  ...vendorDocuments,
  ...developerDocuments,
  ...helpDocuments,
]

export const CATEGORY_META: Record<PublicDocumentCategory, { title: string; eyebrow: string; description: string }> = {
  company: {
    title: 'Company',
    eyebrow: 'About Wewed',
    description: 'Who Wewed serves, how the platform works and the official company information published for wewed.pro.',
  },
  trust: {
    title: 'Trust & Safety',
    eyebrow: 'Trust at Wewed',
    description: 'Plain-language standards for marketplace integrity, verification, reviews, safety, accessibility and security.',
  },
  legal: {
    title: 'Legal Center',
    eyebrow: 'Wewed policies',
    description: 'The rules, privacy commitments and commercial terms that govern use of Wewed at wewed.pro.',
  },
  vendors: {
    title: 'Vendor Resources',
    eyebrow: 'For wedding professionals',
    description: 'Standards, ranking, verification, reviews and practical help for venues and wedding-service providers on Wewed.',
  },
  developers: {
    title: 'Developer Center',
    eyebrow: 'Wewed developers',
    description: 'The public integration contract Wewed will use for supported API access, including security, errors, rate limits and versioning.',
  },
  help: {
    title: 'Help Center',
    eyebrow: 'Using Wewed',
    description: 'Role-specific help for couples, planners, vendors and guests using Wewed before, during and after a wedding.',
  },
}

export function getPublicDocuments(category: PublicDocumentCategory) {
  return PUBLIC_SITE_DOCUMENTS.filter((document) => document.category === category)
}

export function getPublicDocument(category: PublicDocumentCategory, slug: string) {
  return PUBLIC_SITE_DOCUMENTS.find((document) => document.category === category && document.slug === slug)
}
