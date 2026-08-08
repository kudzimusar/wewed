export type PublicDocumentCategory = 'legal' | 'trust' | 'developers'

export interface PublicDocumentSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface PublicDocument {
  category: PublicDocumentCategory
  slug: string
  title: string
  summary: string
  effectiveDate?: string
  status?: 'Effective' | 'Operational guidance'
  sections: PublicDocumentSection[]
}

export const WEWED_DOMAIN = 'wewed.pro'
export const POLICY_EFFECTIVE_DATE = 'August 7, 2026'

const legal = (slug: string, title: string, summary: string, sections: PublicDocumentSection[]): PublicDocument => ({
  category: 'legal', slug, title, summary, effectiveDate: POLICY_EFFECTIVE_DATE, status: 'Effective', sections,
})

const trust = (slug: string, title: string, summary: string, sections: PublicDocumentSection[]): PublicDocument => ({
  category: 'trust', slug, title, summary, effectiveDate: POLICY_EFFECTIVE_DATE, status: 'Operational guidance', sections,
})

const developer = (slug: string, title: string, summary: string, sections: PublicDocumentSection[]): PublicDocument => ({
  category: 'developers', slug, title, summary, status: 'Operational guidance', sections,
})

export const PUBLIC_DOCUMENTS: PublicDocument[] = [
  legal('terms', 'Terms of Service', 'The master terms for using Wewed, including accounts, wedding workspaces, marketplace features and subscriptions.', [
    { heading: 'Using Wewed', paragraphs: ['Wewed provides wedding-planning technology at wewed.pro for couples, planners, vendors, guests and authorized team members. By creating an account, accepting an invitation or using an authenticated Wewed service, you agree to these Terms and the policies that apply to the feature you use.', 'You must provide accurate account information, keep credentials secure and use Wewed only for lawful purposes. You are responsible for activity performed through your account by people you authorize.'] },
    { heading: 'Platform role', paragraphs: ['Unless Wewed expressly says otherwise for a specific transaction, Wewed provides software and marketplace infrastructure. Wewed is not the venue, planner, photographer, caterer or other wedding-service provider selected by a user, and does not become a party to a vendor service contract merely because the parties discovered or coordinated with each other through Wewed.'] },
    { heading: 'Your content and decisions', paragraphs: ['You retain ownership of content you submit. You grant Wewed a limited licence to host, process, reproduce and display that content as needed to operate, secure and improve the service and to make it available to people you deliberately share it with.', 'Wedding decisions can be time-sensitive and financially significant. Users remain responsible for reviewing dates, budgets, vendor terms, AI-generated suggestions, schedules and other critical information before relying on them.'] },
    { heading: 'Availability, changes and enforcement', paragraphs: ['We may update, suspend or discontinue features, address abuse, secure accounts or comply with law. We may restrict or terminate accounts that materially breach these Terms or create risk for other users or the platform. Where practical and appropriate, we will provide notice.', 'Mandatory consumer rights and applicable law are not excluded by these Terms. Separate order forms or negotiated agreements may add terms for particular customers and control where they expressly conflict.'] },
  ]),
  legal('privacy', 'Privacy Policy', 'How Wewed handles account, wedding, guest, vendor, planner, usage and support data.', [
    { heading: 'Information we process', bullets: ['Account and authentication information.', 'Wedding/project details, tasks, schedules, preferences, notes and workspace activity.', 'Guest information supplied by couples or planners, which may include names, contact details, RSVP or event-related preferences.', 'Planner and vendor business/profile information, enquiries and marketplace activity.', 'Subscription and billing metadata; payment-card processing is handled by the payment processor rather than stored as raw card data by Wewed.', 'Device, security, diagnostic and usage information needed to operate and protect the service.', 'Prompts, generated responses and relevant workspace context when an AI feature is used.'] },
    { heading: 'Why we use information', bullets: ['Provide, personalize and secure Wewed.', 'Coordinate authorized wedding participants and service providers.', 'Process subscriptions and account administration.', 'Prevent fraud, abuse and unauthorized access.', 'Support users, investigate reports and enforce platform rules.', 'Improve product reliability and features using appropriately controlled analytics and feedback.', 'Meet legal obligations and protect rights, safety and the integrity of the service.'] },
    { heading: 'Guest and third-party data', paragraphs: ['A user may add information about a partner, guest, vendor contact or other person who does not hold a Wewed account. The submitting user must have a legitimate reason and any permission required to provide that information. Wewed uses such data for the wedding or service purpose for which it was supplied and does not grant vendors a general right to repurpose guest or lead data for unrelated marketing.'] },
    { heading: 'Sharing and processors', paragraphs: ['We share information with authorized workspace participants according to product permissions and with service providers that help us run Wewed, such as hosting/database, billing and configured AI providers. We may also disclose information where required by law or necessary to protect users and the service.', 'We do not treat a user uploading private wedding information as permission to make it public. Visibility is governed by the feature, workspace permissions and choices made by authorized users.'] },
    { heading: 'Retention and choices', paragraphs: ['We retain information for as long as needed to provide the service, maintain legitimate business and security records, resolve disputes and meet legal obligations. Available account, project export, deletion or access controls should be used where provided; additional privacy requests can be made through the support/contact channel presented on wewed.pro or inside the authenticated product.', 'Privacy rights differ by location. Wewed will honor rights required by applicable law after appropriate identity verification.'] },
  ]),
  legal('cookies', 'Cookie & Similar Technologies Policy', 'How Wewed uses browser storage and similar technologies for essential operation, preferences, security and measured product improvement.', [
    { heading: 'Essential technologies', paragraphs: ['Wewed may use cookies, local storage and comparable technologies required for authentication, security, session continuity, preferences and core product operation. Disabling essential storage can prevent parts of the service from working.'] },
    { heading: 'Analytics and optional technologies', paragraphs: ['Where Wewed uses non-essential analytics, advertising or measurement technologies, their use must follow the consent rules applicable to the visitor. Wewed should not describe a technology as essential merely to avoid a consent requirement.'] },
    { heading: 'Your controls', paragraphs: ['Browser controls can remove or block stored data. Where a Wewed cookie-preference control is presented, use it for the categories it covers. Device/browser settings and legally required opt-out mechanisms may provide additional choices.'] },
  ]),
  legal('marketplace', 'Marketplace Terms', 'Rules governing discovery and interaction between couples, planners, venues and other wedding providers.', [
    { heading: 'Independent providers', paragraphs: ['Marketplace providers are independent businesses or professionals unless Wewed expressly identifies a different relationship. A listing, ranking, badge or profile does not by itself make that provider an employee, agent or representative of Wewed.'] },
    { heading: 'Due diligence', paragraphs: ['Users should independently evaluate provider suitability, availability, pricing, licensing, insurance and contract terms where relevant. Verification labels must be read according to the specific check described by Wewed; no generic badge should be treated as a guarantee of quality, safety or future performance.'] },
    { heading: 'Transactions and disputes', paragraphs: ['Unless a Wewed checkout explicitly says Wewed is the merchant or contracting party, the wedding-service agreement is between the customer and provider. Provider cancellations, deposits, deliverables and service remedies are governed by that agreement and applicable law.', 'Wewed may provide reporting, evidence-preservation, communication or discovery tools without assuming the provider’s contractual obligations.'] },
  ]),
  legal('vendor-terms', 'Vendor & Provider Terms', 'Additional obligations for planners, venues and wedding-service businesses using Wewed.', [
    { heading: 'Accurate business information', bullets: ['Use a genuine business or professional identity.', 'Keep services, location, availability and material profile claims reasonably accurate.', 'Maintain licences, registrations, permissions or insurance required for the services you offer.', 'Do not impersonate another business or use portfolio material without appropriate rights.'] },
    { heading: 'Customer and guest data', paragraphs: ['Information received through Wewed may be used to respond to the relevant enquiry, booking or wedding relationship. It may not be harvested, sold, scraped or added to unrelated marketing lists without a lawful basis and any consent required by law.'] },
    { heading: 'Fair marketplace conduct', bullets: ['Do not fabricate bookings, reviews, credentials, availability or awards.', 'Do not buy, coerce or exchange incentives for misleading reviews.', 'Do not discriminate in violation of applicable law or Wewed marketplace standards.', 'Do not use Wewed to facilitate fraud, harassment, unsafe conduct or prohibited services.', 'Cooperate reasonably with investigations of credible safety, fraud, IP or marketplace-integrity reports.'] },
  ]),
  legal('acceptable-use', 'Acceptable Use Policy', 'The baseline rules against abuse, fraud, unlawful conduct and technical misuse of Wewed.', [
    { heading: 'Prohibited conduct', bullets: ['Fraud, impersonation, deceptive listings or fabricated transactions.', 'Harassment, threats, stalking, hate-based abuse or unlawful discrimination.', 'Malware, credential theft, security bypass attempts or unauthorized access.', 'Bulk scraping, automated extraction or resale of Wewed data without written authorization.', 'Spam or unsolicited communications that violate law or platform rules.', 'Uploading content that infringes rights, exposes private information without justification or is otherwise unlawful.', 'Using Wewed to arrange illegal goods, services or activity.'] },
    { heading: 'Enforcement', paragraphs: ['Wewed may remove content, limit functionality, preserve evidence, suspend accounts or terminate access when reasonably necessary to protect users, the platform or legal compliance. Enforcement decisions may consider severity, repetition, intent, available evidence and immediate safety risk.'] },
  ]),
  legal('content-community', 'Content & Community Policy', 'Standards for profiles, uploads, messages, public content and collaborative wedding spaces.', [
    { heading: 'Keep content authentic and respectful', paragraphs: ['Content should accurately represent the person, wedding, business or service it concerns. Do not publish private identifiers, intimate information or guest information outside the intended wedding context without a legitimate basis.'] },
    { heading: 'Moderation', paragraphs: ['Wewed may restrict content that violates law, intellectual-property rights, privacy, safety standards or marketplace integrity. Context matters: criticism and negative experiences are not prohibited merely because they are unfavorable.'] },
  ]),
  legal('reviews', 'Review Policy', 'Rules designed to keep marketplace reviews genuine, relevant and resistant to manipulation.', [
    { heading: 'Who should review', paragraphs: ['Reviews should come from people with a genuine first-hand relationship or material experience with the provider. Wewed may request reasonable evidence such as a booking record, contract, invoice, communication or other proof of the relationship.'] },
    { heading: 'Review integrity', bullets: ['No fabricated, purchased or competitor-sabotage reviews.', 'No threats or pressure to obtain a particular rating.', 'Incentives must not be conditioned on a positive review and must be disclosed where required.', 'Reviews may describe positive or negative experiences when they remain relevant and comply with content rules.', 'Providers may report reviews for policy reasons; payment to Wewed does not create a right to remove legitimate criticism.'] },
    { heading: 'Verified labels', paragraphs: ['A “verified” label must correspond to a defined check, such as a confirmed Wewed relationship or reviewed evidence. It does not mean Wewed guarantees every statement in a review.'] },
  ]),
  legal('payments-refunds', 'Payments, Subscriptions, Cancellations & Refunds', 'How Wewed subscription billing differs from contracts and payments for wedding services.', [
    { heading: 'Wewed subscriptions', paragraphs: ['Wewed may offer paid plans. Current account billing is processed through Stripe Billing. Prices, billing periods, taxes, renewal behavior and cancellation controls presented at checkout or in the billing area form part of the applicable purchase terms.'] },
    { heading: 'Vendor service payments', paragraphs: ['A Wewed subscription charge is different from a payment owed to a wedding provider. Unless a specific Wewed payment flow expressly identifies Wewed as the merchant or contracting party, provider deposits, refunds, cancellations and service performance are governed by the customer-provider agreement.'] },
    { heading: 'Refunds and statutory rights', paragraphs: ['Any Wewed refund right shown at purchase applies in addition to non-waivable consumer rights. Chargebacks or payment disputes should not be used fraudulently and may lead to account review when misuse is reasonably suspected.'] },
  ]),
  legal('intellectual-property', 'Copyright & Intellectual Property Policy', 'Ownership, licences and reporting rules for photographs, portfolios, documents and other protected material.', [
    { heading: 'Ownership and licence', paragraphs: ['Users keep ownership of content they own. By uploading content, the uploader represents that they have the rights needed for Wewed to host and display it for the intended platform purpose, and grants Wewed the limited operational licence necessary to do so.'] },
    { heading: 'Marketing use is separate', paragraphs: ['Private wedding or provider content should not be treated as automatically licensed for unrelated Wewed advertising merely because it can be displayed inside the product. Any broader promotional use should have a separate lawful basis or permission.'] },
    { heading: 'Rights reports', paragraphs: ['A rights holder may report allegedly infringing material through Wewed’s support/reporting channel with enough information to identify the work, the disputed material and the reporter’s authority. Wewed may remove or restrict material while a credible claim is evaluated.'] },
  ]),
  legal('communications', 'Electronic Communications Policy', 'Rules for product notices, transactional messages and marketing communications.', [
    { heading: 'Service communications', paragraphs: ['Wewed may send communications needed to operate an account or wedding workflow, such as authentication, invitations, security alerts, billing notices and material service updates.'] },
    { heading: 'Marketing', paragraphs: ['Promotional email, SMS or similar marketing must follow applicable consent and opt-out requirements. A wedding enquiry or guest invitation is not automatically permission for unrelated marketing.'] },
  ]),
  legal('nondiscrimination', 'Non-Discrimination Policy', 'Marketplace expectations for fair and lawful treatment of couples, guests, planners and providers.', [
    { heading: 'Standard', paragraphs: ['Wewed does not permit users to use the platform to engage in unlawful discrimination. Providers and users remain subject to the laws that apply to their services, location and conduct.'] },
    { heading: 'Reports', paragraphs: ['Credible discrimination reports may be reviewed alongside relevant communications, listing information and other available evidence. Wewed may take proportionate platform action where policy violations are established.'] },
  ]),
  legal('ai-transparency', 'AI Use & Transparency Policy', 'How Wewed uses configured AI providers and the limits users should understand before relying on generated output.', [
    { heading: 'AI-assisted features', paragraphs: ['Wewed includes AI infrastructure that can use configured providers including Groq, Google Gemini and Z.ai. The specific provider and model may change based on configuration, availability and product needs.'] },
    { heading: 'Data sent for inference', paragraphs: ['When a user invokes an AI feature, Wewed may send the prompt and the minimum relevant product context needed to answer the request to the configured AI provider. Users should avoid placing unnecessary sensitive information into prompts.'] },
    { heading: 'Human review remains important', paragraphs: ['AI output may be incomplete, inaccurate or outdated. It is assistance, not a substitute for professional legal, financial, medical or safety advice. Users must verify high-impact information such as contracts, payments, deadlines, vendor commitments and wedding-day instructions before acting.'] },
    { heading: 'No silent commitments', paragraphs: ['AI-generated text or recommendations do not by themselves create a vendor contract, authorize a payment or change a binding agreement. Product features that perform consequential actions should require an authorized user action.'] },
  ]),
  legal('developer-terms', 'Developer & API Terms', 'Rules for authorized integrations, automation and programmatic access to Wewed.', [
    { heading: 'No implied public API', paragraphs: ['Wewed currently uses application endpoints to operate its own product. Their existence does not create a public, stable or supported third-party API contract. Public API access is available only when Wewed expressly issues credentials or documentation for that purpose.'] },
    { heading: 'Authorized access only', bullets: ['Use only documented credentials, scopes and endpoints made available to you.', 'Do not bypass rate limits, authentication, tenancy or authorization controls.', 'Request and retain only the data needed for the approved integration purpose.', 'Protect credentials and promptly rotate or report exposed secrets.', 'Do not use API access to build surveillance, spam, scraping or data-broker products.'] },
  ]),
  legal('data-processing', 'Data Processing Addendum', 'Baseline processing commitments for customers that use Wewed to process personal data on behalf of an organization.', [
    { heading: 'Scope', paragraphs: ['Where Wewed processes personal data on behalf of a business customer and applicable data-protection law requires processor terms, this addendum supplements the customer agreement. The customer determines the permitted purpose and is responsible for having a lawful basis for the data it instructs Wewed to process.'] },
    { heading: 'Processing commitments', bullets: ['Process covered data on documented instructions, except where law requires otherwise.', 'Apply appropriate confidentiality and security controls.', 'Use subprocessors subject to appropriate data-protection obligations.', 'Provide reasonable assistance with legally required data-subject and incident obligations, taking account of the nature of processing.', 'Delete or return covered data as required by the agreement and applicable law, subject to lawful retention obligations.'] },
    { heading: 'Jurisdiction-specific terms', paragraphs: ['International transfer mechanisms, controller/processor details and legally required annexes depend on the customer and jurisdiction and should be incorporated into an order form or signed DPA where required.'] },
  ]),
  legal('subprocessors', 'Subprocessor & Service Provider Notice', 'The main external service categories Wewed can use to operate billing, infrastructure and AI-assisted features.', [
    { heading: 'Current supported integrations', bullets: ['Stripe — subscription billing and payment processing for Wewed account plans.', 'Supabase — database, authentication or infrastructure capabilities where configured by the deployment.', 'Groq — AI inference where configured.', 'Google Gemini — AI inference where configured.', 'Z.ai — AI inference where configured.'] },
    { heading: 'Changes', paragraphs: ['Providers and deployment configuration may change as Wewed evolves. This notice describes supported/currently integrated service providers observed in the product code; it should be maintained alongside infrastructure changes and should not be treated as a substitute for a customer-specific signed DPA where one is required.'] },
  ]),

  trust('trust-at-wewed', 'Trust at Wewed', 'The principles Wewed uses to make wedding collaboration safer, clearer and more accountable.', [
    { heading: 'Our trust model', bullets: ['Private-by-context wedding collaboration rather than assuming all wedding information is public.', 'Specific verification claims instead of vague guarantees.', 'Fair review and marketplace rules that apply to paying and non-paying users.', 'Purpose-limited use of guest and lead information.', 'Clear separation between Wewed software and independent provider obligations.', 'Human confirmation for consequential decisions, including AI-assisted workflows.'] },
    { heading: 'Trust is a product feature', paragraphs: ['Policies alone do not create safety. Wewed’s product roadmap should pair these commitments with permissions, auditability, reporting, export/deletion controls and understandable disclosure at the point a user shares data or takes a consequential action.'] },
  ]),
  trust('vendor-standards', 'Vendor & Planner Standards', 'What Wewed expects from professionals who appear or work on the platform.', [
    { heading: 'Professional baseline', bullets: ['Represent identity, services, location and experience accurately.', 'Honor confirmed commitments or communicate changes promptly.', 'Protect couple and guest information.', 'Use portfolio content with permission.', 'Maintain legally required professional credentials where applicable.', 'Treat reviews and marketplace ranking honestly.', 'Use Wewed communications respectfully and safely.'] },
  ]),
  trust('verification', 'How Verification Works', 'A verification label should tell users exactly what Wewed checked—and nothing more.', [
    { heading: 'Specific, not absolute', paragraphs: ['Wewed should use labels such as Business Identity Verified, Contact Verified or Verified Client Review only when the corresponding check has actually been completed. A verification check is evidence about the checked attribute; it is not insurance, an endorsement or a guarantee of future service quality.'] },
    { heading: 'Badge lifecycle', paragraphs: ['Verification can expire or become inaccurate. Wewed may request updated evidence, remove a badge or re-check information when a business changes ownership, material profile details change or credible concerns arise.'] },
  ]),
  trust('review-integrity', 'Review Integrity', 'How Wewed aims to keep reviews useful without turning moderation into pay-to-play reputation management.', [
    { heading: 'Fairness', paragraphs: ['Positive and negative first-hand experiences are allowed when they comply with policy. Vendors can challenge reviews for specific policy reasons and may provide evidence, but commercial status with Wewed is not a removal criterion.'] },
    { heading: 'Signals', paragraphs: ['Where the product can substantiate a customer-provider relationship, Wewed may show a verification signal. The label should identify the nature of the evidence rather than imply that every factual statement was independently investigated.'] },
  ]),
  trust('marketplace-safety', 'Marketplace Safety', 'Practical safeguards for couples, planners and providers using Wewed to discover and coordinate services.', [
    { heading: 'Before committing', bullets: ['Confirm provider identity and contact details.', 'Use a written contract for material wedding services.', 'Verify price, payment schedule, cancellation terms and deliverables.', 'Check required licences or insurance where relevant.', 'Keep important decisions and evidence in durable records.'] },
    { heading: 'When something goes wrong', paragraphs: ['Use available Wewed reporting/support channels, preserve relevant messages/contracts and contact appropriate payment, legal or emergency services when the issue falls outside Wewed’s platform role. Wewed may restrict accounts or preserve platform evidence but cannot promise that an independent provider will perform a contract.'] },
  ]),
  trust('scam-prevention', 'Scam Prevention', 'Warning signs and platform expectations intended to reduce wedding marketplace fraud.', [
    { heading: 'Common warning signs', bullets: ['Pressure to pay immediately without clear written terms.', 'Requests to move to unusual payment methods with weak recovery options.', 'Identity, portfolio or business details that cannot be reconciled.', 'A price or availability claim that changes materially after contact.', 'Requests for guest lists or personal data unrelated to the service.', 'Messages requesting passwords, one-time codes or Wewed credentials.'] },
    { heading: 'Account security', paragraphs: ['Wewed will not need a user’s password or one-time authentication code in order to review an ordinary marketplace issue. Suspected credential theft or impersonation should be reported promptly.'] },
  ]),
  trust('reporting', 'Reporting & Enforcement', 'How safety, fraud, privacy, review and content concerns can be raised and evaluated.', [
    { heading: 'What to include', paragraphs: ['A useful report identifies the account/listing/content, describes what happened, includes relevant dates and provides available evidence without unnecessarily exposing unrelated personal data.'] },
    { heading: 'How Wewed responds', paragraphs: ['Responses depend on severity and available evidence and can include requesting information, limiting content, preserving records, restricting features, suspending access or taking no action where a violation is not established. Immediate physical danger should be handled through appropriate local emergency channels rather than waiting for a platform review.'] },
  ]),
  trust('security', 'Security at Wewed', 'A factual overview of the security expectations around Wewed accounts and data.', [
    { heading: 'Security approach', paragraphs: ['Wewed uses authenticated accounts, authorization boundaries and application/infrastructure controls to protect platform data. Security is an ongoing process and no online service can promise absolute security.'] },
    { heading: 'User responsibilities', bullets: ['Use a unique password and protect authentication factors.', 'Do not share credentials across planner or vendor staff when separate authorized access is available.', 'Review access when a team member leaves a business or wedding project.', 'Report suspected account compromise promptly.', 'Avoid uploading secrets or personal information that is unnecessary for wedding coordination.'] },
    { heading: 'Vulnerability reports', paragraphs: ['Good-faith security researchers should report reproducible vulnerabilities through Wewed’s published support/contact channel and avoid accessing unrelated user data, disrupting the service or publicly disclosing an issue before Wewed has a reasonable opportunity to investigate.'] },
  ]),
  trust('privacy-at-wewed', 'Privacy at Wewed', 'A plain-language explanation of how privacy should work across collaborative wedding spaces.', [
    { heading: 'Share intentionally', paragraphs: ['Wedding information can reveal identities, locations, schedules and guest relationships. Wewed’s privacy principle is that access should follow the purpose and permissions of the wedding space, not a default assumption that all information belongs on the public web.'] },
    { heading: 'Guest information', paragraphs: ['Guest data should be visible only to people who need it for the relevant wedding purpose. Vendors should receive only information appropriate to their role and may not treat access as permission for unrelated marketing.'] },
  ]),
  trust('ranking-transparency', 'Marketplace Ranking & Sponsorship', 'The transparency standard Wewed applies when ordering marketplace results or introducing paid placement.', [
    { heading: 'Organic ranking', paragraphs: ['Marketplace ordering may consider factors such as relevance, service category, location, profile completeness, availability signals, review quality and platform activity. Ranking logic can evolve and anti-abuse signals may remain confidential.'] },
    { heading: 'Paid placement', paragraphs: ['If payment materially influences placement, the result should be clearly identifiable as sponsored or promoted. Paying for placement must not purchase a positive review, a fabricated verification result or exemption from marketplace rules.'] },
  ]),
  trust('accessibility', 'Accessibility Statement', 'Wewed’s commitment to making wedding planning usable by people with disabilities.', [
    { heading: 'Commitment', paragraphs: ['Wewed aims to design and improve public and authenticated experiences with WCAG 2.2 Level AA as the working accessibility target. This statement is a product commitment, not a claim that every current screen has completed an independent conformance audit.'] },
    { heading: 'Feedback', paragraphs: ['Accessibility barriers should be reported through the support/contact path available on wewed.pro with the affected page or workflow, assistive technology where relevant and a description of the problem.'] },
  ]),
  trust('transparency', 'Transparency & Policy Updates', 'How Wewed will communicate material policy, marketplace and trust changes as the platform grows.', [
    { heading: 'Versioned policies', paragraphs: ['Public policies display an effective date. Material changes should update that date and, where appropriate, be communicated to affected account holders before or when the change becomes effective.'] },
    { heading: 'Future reporting', paragraphs: ['As Wewed’s scale warrants it, the platform can publish aggregate trust metrics such as fraudulent listings removed, review-integrity actions, major safety improvements and policy changes, provided the reporting does not expose personal data or anti-abuse methods.'] },
  ]),

  developer('overview', 'Developer Overview', 'The current status and principles for Wewed integrations and programmatic access.', [
    { heading: 'Current API status', paragraphs: ['Wewed has internal application endpoints that power the product. They are not presently represented here as a public third-party API contract. Do not build external integrations against undocumented internal routes or assume route stability.'] },
    { heading: 'Public API readiness standard', paragraphs: ['When Wewed enables third-party API access, it should ship with documented authentication, scopes, stable resource models, rate limits, idempotency where needed, webhook verification, versioning, changelog and developer terms before credentials are issued broadly.'] },
  ]),
  developer('quickstart', 'API Quickstart', 'What developers will need before making a supported Wewed API request.', [
    { heading: 'Availability', paragraphs: ['Public third-party API credentials are not generally available at this stage. This page records the contract Wewed will follow when access is enabled rather than exposing internal application routes.'] },
    { heading: 'Planned flow', bullets: ['Register or approve an integration.', 'Receive environment-specific credentials.', 'Request only the scopes the integration needs.', 'Use documented versioned endpoints.', 'Verify webhooks and implement retry-safe handling.', 'Test against non-production data before production access.'] },
  ]),
  developer('authentication', 'Authentication & Permissions', 'Security rules for future supported integrations.', [
    { heading: 'Credentials', paragraphs: ['API keys, OAuth credentials and signing secrets must be treated as secrets, stored server-side where appropriate and rotated after suspected exposure. Credentials may not be embedded in publicly distributed client code when doing so would expose privileged access.'] },
    { heading: 'Least privilege', paragraphs: ['Integrations should receive only the weddings, organizations, roles and resource scopes necessary for their approved purpose. A valid credential does not override tenant, role or resource authorization.'] },
  ]),
  developer('data-model', 'API Data Model', 'The resource boundary Wewed will use when publishing supported integration contracts.', [
    { heading: 'Core concepts', bullets: ['Accounts and authorized roles.', 'Wedding/project workspaces.', 'Planner organizations and team membership.', 'Couples and invited collaborators.', 'Vendors/providers and marketplace profiles.', 'Tasks, schedules, templates and operational planning data.', 'Guests and event participation data where permission allows.', 'Billing/subscription metadata where relevant to the authorized account.'] },
    { heading: 'Privacy boundary', paragraphs: ['A public API must not turn private wedding or guest information into broadly discoverable data. Resource access must inherit the same or stricter authorization boundaries as the product UI.'] },
  ]),
  developer('errors-rate-limits', 'Errors, Rate Limits & Retries', 'The reliability contract Wewed will apply to supported API clients.', [
    { heading: 'Errors', paragraphs: ['Supported APIs should return consistent HTTP status codes and structured error identifiers without leaking secrets or cross-tenant information. Clients should distinguish validation, authentication, authorization, rate-limit and transient server failures.'] },
    { heading: 'Rate limits', paragraphs: ['Published APIs should document rate limits and retry behavior. Clients must honor limits and use exponential backoff or server-provided retry guidance instead of aggressive polling.'] },
  ]),
  developer('webhooks', 'Webhooks', 'The delivery and verification standard for future Wewed event notifications.', [
    { heading: 'Security', paragraphs: ['Webhook deliveries should be signed and recipients must verify the signature using the documented method before trusting the payload. Secrets must be rotatable.'] },
    { heading: 'Delivery semantics', paragraphs: ['Consumers should assume deliveries can be retried, delayed or duplicated and process event identifiers idempotently. Event payloads should contain only information appropriate to the integration’s authorization.'] },
  ]),
  developer('versioning', 'API Versioning & Deprecation', 'How Wewed will protect supported integrations from unannounced breaking changes.', [
    { heading: 'Stable contracts', paragraphs: ['Once an API surface is publicly documented as supported, breaking changes should be introduced through an explicit version or migration path rather than silently changing the meaning of an existing contract.'] },
    { heading: 'Deprecation', paragraphs: ['Where practical, Wewed should publish a deprecation notice, migration guidance and a reasonable transition period before retiring a supported version, subject to emergency security or legal changes.'] },
  ]),
  developer('security', 'Developer Security', 'Minimum security expectations for integrations that access Wewed data.', [
    { heading: 'Integration responsibilities', bullets: ['Protect credentials and signing secrets.', 'Encrypt sensitive data in transit and use appropriate storage controls.', 'Do not request or retain data beyond the approved purpose.', 'Apply tenant and user authorization consistently.', 'Maintain logs sufficient to investigate abuse without unnecessarily logging sensitive content.', 'Report credential compromise or material security incidents promptly.'] },
  ]),
  developer('changelog', 'Developer Changelog', 'A home for material public API and integration changes.', [
    { heading: 'Current state', paragraphs: ['No generally available public API version is announced in this documentation yet. The first supported public API release should be recorded here with its version, release date, authentication method and migration expectations.'] },
  ]),
]

export const CATEGORY_META: Record<PublicDocumentCategory, { title: string; eyebrow: string; description: string }> = {
  legal: {
    title: 'Legal Center',
    eyebrow: 'Wewed policies',
    description: 'The rules, privacy commitments and commercial terms that govern use of Wewed at wewed.pro.',
  },
  trust: {
    title: 'Trust & Safety Center',
    eyebrow: 'Trust at Wewed',
    description: 'Plain-language standards for privacy, marketplace integrity, security, reviews and safer wedding collaboration.',
  },
  developers: {
    title: 'Developer Center',
    eyebrow: 'Wewed developers',
    description: 'Integration standards, API readiness guidance and the contract Wewed will use for supported developer access.',
  },
}

export function getPublicDocuments(category: PublicDocumentCategory) {
  return PUBLIC_DOCUMENTS.filter((document) => document.category === category)
}

export function getPublicDocument(category: PublicDocumentCategory, slug: string) {
  return PUBLIC_DOCUMENTS.find((document) => document.category === category && document.slug === slug)
}
