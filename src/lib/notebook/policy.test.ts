import { describe, expect, test } from 'bun:test'
import { notebookActorCanEdit, notebookActorCanRead } from './policy'
import type { NotebookActor, NotebookNoteRow } from './types'

function actor(overrides: Partial<NotebookActor> = {}): NotebookActor {
  return {
    session: {
      v: 2,
      userId: 'user-a',
      authUserId: 'auth-a',
      email: 'a@example.com',
      role: 'planner',
      coupleId: null,
      activeWeddingId: 'wedding-a',
      expiresAt: Date.now() + 60_000,
    },
    platformAdmin: false,
    weddings: [],
    accessibleWeddingIds: ['wedding-a'],
    editableWeddingIds: ['wedding-a'],
    ...overrides,
  }
}

function note(overrides: Partial<NotebookNoteRow> = {}): NotebookNoteRow {
  return {
    id: 'note-a',
    ownerUserId: 'owner',
    weddingId: null,
    adminAccountId: null,
    contextType: 'personal',
    title: 'Note',
    contentJson: {},
    contentText: 'private detail',
    noteType: 'GENERAL',
    visibility: 'PRIVATE',
    isPinned: false,
    archivedAt: null,
    deletedAt: null,
    version: 1,
    createdByUserId: 'owner',
    updatedByUserId: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    shareRole: null,
    ...overrides,
  }
}

describe('Notebook authorization policy', () => {
  test('private note is owner-only even for a platform administrator', () => {
    const privateNote = note({ ownerUserId: 'owner', visibility: 'PRIVATE' })
    expect(notebookActorCanRead(actor({ platformAdmin: true }), privateNote)).toBe(false)
    expect(notebookActorCanRead(actor({ session: { ...actor().session, userId: 'owner' } }), privateNote)).toBe(true)
  })

  test('wedding-team note is readable only inside an accessible wedding', () => {
    const teamNote = note({ weddingId: 'wedding-a', visibility: 'WEDDING_TEAM' })
    expect(notebookActorCanRead(actor(), teamNote)).toBe(true)
    expect(notebookActorCanRead(actor({ accessibleWeddingIds: [] }), teamNote)).toBe(false)
  })

  test('wedding-team editing requires current edit authority', () => {
    const teamNote = note({ weddingId: 'wedding-a', visibility: 'WEDDING_TEAM' })
    expect(notebookActorCanEdit(actor(), teamNote)).toBe(true)
    expect(notebookActorCanEdit(actor({ editableWeddingIds: [] }), teamNote)).toBe(false)
  })

  test('explicit viewer can read but cannot edit', () => {
    const shared = note({ visibility: 'SELECTED_USERS', shareRole: 'VIEWER' })
    expect(notebookActorCanRead(actor(), shared)).toBe(true)
    expect(notebookActorCanEdit(actor(), shared)).toBe(false)
  })

  test('explicit editor can read and edit', () => {
    const shared = note({ visibility: 'SELECTED_USERS', shareRole: 'EDITOR' })
    expect(notebookActorCanRead(actor(), shared)).toBe(true)
    expect(notebookActorCanEdit(actor(), shared)).toBe(true)
  })

  test('admin-internal notes are readable to platform admins but not editable merely because of admin status', () => {
    const internal = note({ visibility: 'ADMIN_INTERNAL' })
    const admin = actor({ platformAdmin: true, accessibleWeddingIds: [], editableWeddingIds: [] })
    expect(notebookActorCanRead(admin, internal)).toBe(true)
    expect(notebookActorCanEdit(admin, internal)).toBe(false)
  })
})
