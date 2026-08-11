import { NextRequest } from 'next/server'
import {
  listCommunicationContacts,
  requireCommunicationActor,
} from '@/lib/communications'
import { listEligibleVendorContacts } from '@/lib/vendor-marketplace-communications'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const [contacts, vendorContacts] = await Promise.all([
      listCommunicationContacts(actor),
      listEligibleVendorContacts(actor),
    ])
    const merged = new Map(contacts.map((contact) => [contact.id, contact]))
    for (const contact of vendorContacts) merged.set(contact.id, contact)
    const data = Array.from(merged.values()).sort((a, b) => {
      if (a.context !== b.context) return a.context === 'wewed' ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    return communicationJson({ success: true, data })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}