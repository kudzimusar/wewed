import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

const source = (path: string) => readFileSync(path, 'utf8')

const manual = source('docs/WEWED_PRODUCT_UI_UX_AND_COMMUNICATIONS_MANUAL.md')
const quickNavigation = source('src/components/navigation/workspace-quick-navigation.tsx')
const messageSettings = source('src/app/messages/settings/page.tsx')
const notificationSettings = source('src/app/settings/notifications/page.tsx')
const notifications = source('src/app/notifications/page.tsx')
const notificationSectionNavigation = source('src/components/notifications/notification-section-navigation.tsx')
const attachmentList = source('src/components/communications/communication-attachment-list.tsx')
const emailTemplate = source('src/lib/email/wewed-template.ts')
const verificationRoute = source('src/app/api/notifications/email-verification/route.ts')

describe('WW-PRODUCT-UI-2026-08-23-01 product UI and communications contract', () => {
  test('stamps one authoritative compact product design manual', () => {
    expect(manual).toContain('WW-PRODUCT-UI-2026-08-23-01')
    expect(manual).toContain('STAMPED — AUTHORITATIVE PRODUCT DESIGN MANUAL')
    expect(manual).toContain('Compact premium utility UI')
    expect(manual).toContain('Glassmorphism is an accent, not the page skeleton')
    expect(manual).toContain('no permanent bottom floating Back/Forward/Bell/Account pill')
    expect(manual).toContain('Communication delivery settings contract')
    expect(manual).toContain('Branded outbound email manual')
  })

  test('moves persistent account and notification chrome into a compact top menu', () => {
    expect(quickNavigation).toContain('aria-label="Open Wewed menu"')
    expect(quickNavigation).toContain('showLabel')
    expect(quickNavigation).toContain('href="/settings"')
    expect(quickNavigation).toContain('Switch account')
    expect(quickNavigation).toContain('Sign out')
    expect(quickNavigation).toContain('window.history.back()')
    expect(quickNavigation).toContain('window.history.forward()')
    expect(quickNavigation).toContain('top-[max(0.75rem,env(safe-area-inset-top))]')
    expect(quickNavigation).not.toContain('bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]')
  })

  test('renders communication delivery as compact operational rows with advanced phone setup disclosed', () => {
    expect(messageSettings).toContain('Delivery preferences')
    expect(messageSettings).toContain('Add or change a phone number')
    expect(messageSettings).toContain('<details')
    expect(messageSettings).toContain('<StatusPill tone="ready">Verified</StatusPill>')
    expect(messageSettings).toContain('<StatusPill tone="ready">Ready</StatusPill>')
    expect(messageSettings).toContain('activation.PUSH.activeDeviceCount')
    expect(messageSettings).toContain('href="/settings/notifications/push"')
    expect(messageSettings).toContain('Email verification arrives in your external mailbox')
    expect(messageSettings).not.toContain('pb-32')
    expect(messageSettings).not.toContain('Wewed transport is configured.')
  })

  test('keeps notification controls compact while preserving activation truth and consent flows', () => {
    expect(notificationSettings).toContain('Canonical Wewed notification history · always on')
    expect(notificationSettings).toContain('capability.ready')
    expect(notificationSettings).toContain('Verify account email')
    expect(notificationSettings).toContain("allowCommunication('EMAIL')")
    expect(notificationSettings).toContain("allowCommunication('WHATSAPP')")
    expect(notificationSettings).toContain('Manage devices')
    expect(notificationSettings).toContain('Quiet from')
    expect(notificationSettings).toContain('Quiet until')
    expect(notificationSettings).not.toContain('pb-32')
  })

  test('uses a compact activity-inbox hierarchy rather than large notification cards', () => {
    expect(notifications).toContain('data-testid="notification-open-source"')
    expect(notifications).toContain('/notifications/open/${encodeURIComponent(item.id)}')
    expect(notifications).toContain('notification-acknowledged-state')
    expect(notifications).toContain("window.addEventListener('focus', onFocus)")
    expect(notifications).toContain("document.addEventListener('visibilitychange', refreshWhenVisible)")
    expect(notifications).toContain('border-b border-[#bf9b5f]/10')
    expect(notifications).toContain('aria-label={`Open ${item.title}`}')
    expect(notifications).not.toContain('rounded-2xl border p-4 transition sm:p-5')
  })

  test('collapses notification section navigation to familiar icon controls', () => {
    expect(notificationSectionNavigation).toContain('aria-label="Notification settings"')
    expect(notificationSectionNavigation).toContain('aria-label="Back to settings"')
    expect(notificationSectionNavigation).toContain('aria-label="Notifications"')
    expect(notificationSectionNavigation).not.toContain('{workspace.label}')
    expect(notificationSectionNavigation).not.toContain('Notification settings</')
  })

  test('makes secure message attachments media-aware without bypassing Vault authorization', () => {
    expect(attachmentList).toContain("attachment.mimeType.startsWith('image/')")
    expect(attachmentList).toContain("attachment.mimeType.startsWith('video/')")
    expect(attachmentList).toContain("attachment.mimeType.startsWith('audio/')")
    expect(attachmentList).toContain('/api/communications/attachments/${encodeURIComponent(attachment.id)}')
    expect(attachmentList).toContain('signedUrl')
    expect(attachmentList).toContain("window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')")
    expect(attachmentList).not.toContain('<img')
  })

  test('uses an email-safe Wewed template with canonical brand and optional media support', () => {
    expect(emailTemplate).toContain('<!DOCTYPE html>')
    expect(emailTemplate).toContain('<table role="presentation"')
    expect(emailTemplate).toContain('background-color:#FBF7F0')
    expect(emailTemplate).toContain('background-color:#BF9B5F')
    expect(emailTemplate).toContain('Wewed')
    expect(emailTemplate).toContain('https://wewed.pro')
    expect(emailTemplate).toContain('input.media')
    expect(emailTemplate).toContain('alt=')
    expect(emailTemplate).not.toContain('<style>')
    expect(emailTemplate).not.toContain('<div')
  })

  test('brands email verification without weakening canonical origin or expiry rules', () => {
    expect(verificationRoute).toContain("import { renderWewedTransactionalEmail } from '@/lib/email/wewed-template'")
    expect(verificationRoute).toContain("const CANONICAL_WEWED_ORIGIN = 'https://wewed.pro'")
    expect(verificationRoute).toContain('const VERIFICATION_TTL_MS = 30 * 60 * 1000')
    expect(verificationRoute).toContain("ctaLabel: 'Verify account email'")
    expect(verificationRoute).toContain('ctaHref: link')
    expect(verificationRoute).toContain('renderWewedTransactionalEmail({')
    expect(verificationRoute).toContain('It will not appear in Wewed Messages.')
  })
})
