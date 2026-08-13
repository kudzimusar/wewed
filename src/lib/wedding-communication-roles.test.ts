import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('wedding-scoped communication roles', () => {
  test('owner membership resolves to couple without changing the global account role', async () => {
    const roles = await source('src/lib/wedding-communication-roles.ts')

    expect(roles).toContain("input.membershipRole === 'owner' || input.sameCouple")
    expect(roles).toContain("return 'couple'")
    expect(roles).toContain("input.membershipRole === 'planner' || input.membershipRole === 'coordinator'")
    expect(roles).toContain("return 'planner'")
  })

  test('wedding contacts use effective roles and couple-to-couple defaults to DIRECT', async () => {
    const roles = await source('src/lib/wedding-communication-roles.ts')
    const contactsRoute = await source('src/app/api/communications/contacts/route.ts')

    expect(roles).toContain('defaultConversationTypeForRoles(actorRole, target.effectiveRole)')
    expect(roles).toContain("target.effectiveRole === 'planner' ? contact.name : target.personalName")
    expect(contactsRoute).toContain('normalizeWeddingCommunicationContacts')
  })

  test('existing spouse thread is reclassified in place before reuse', async () => {
    const roles = await source('src/lib/wedding-communication-roles.ts')
    const conversationsRoute = await source('src/app/api/communications/conversations/route.ts')

    expect(roles).toContain("c.\"type\" = 'PLANNER_CLIENT'")
    expect(roles).toContain("SET \"type\" = 'DIRECT'")
    expect(roles).toContain("eventType\", \"metadata\")
    expect(roles).toContain('conversation_reclassified')
    expect(roles).toContain("reason: 'shared_wedding_couple_authority'")
    expect(roles).toContain("actor: { ...actor, role: 'couple' }")
    expect(roles).toContain("input: { ...input, type: 'DIRECT', weddingId: actor.activeWeddingId }")
    expect(conversationsRoute).toContain('prepareWeddingScopedConversationCreation(actor, body)')
  })

  test('inbox and thread rendering restore personal couple identity', async () => {
    const roles = await source('src/lib/wedding-communication-roles.ts')
    const conversationsRoute = await source('src/app/api/communications/conversations/route.ts')
    const messagesRoute = await source('src/app/api/communications/conversations/[id]/messages/route.ts')

    expect(roles).toContain("participants.every((participant) => participant.role === 'couple')")
    expect(roles).toContain("? 'DIRECT'")
    expect(roles).toContain("sender.effectiveRole === 'planner' ? message.senderName : sender.personalName")
    expect(conversationsRoute).toContain('normalizeWeddingCommunicationConversations(actor, conversations)')
    expect(messagesRoute).toContain('normalizeWeddingCommunicationMessages(id, messages)')
  })

  test('global planner identity remains available outside the wedding-scoped adapter', async () => {
    const communications = await source('src/lib/communications.ts')
    const roles = await source('src/lib/wedding-communication-roles.ts')

    expect(communications).toContain('role: user.role')
    expect(roles).not.toContain('UPDATE public."User"')
    expect(roles).not.toContain('SET role =')
  })
})
