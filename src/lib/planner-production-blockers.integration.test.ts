import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { db } from './db'
import { executeGuestWorksheetImport } from './import-engine/guest-worksheet-executor'
import { rollbackGuestWorksheetImport } from './import-engine/guest-worksheet-rollback'
import { fetchGuestWorksheetRecords } from './import-engine/guest-worksheet-read'
import { guestWorksheetSchema } from './import-engine/guest-worksheet-schema'
import { generatePreview } from './import-engine/preview'
import type { ParsedFile } from './import-engine/types'

function worksheetFile(row: Record<string, string>): ParsedFile {
  return {
    headers: Object.keys(row),
    rows: [row],
    rawRowCount: 2,
  }
}

describe('Planner production blocker PostgreSQL integration', () => {
  test('Vendor, Timeline and Guest worksheet operations round-trip without loss', async () => {
    const nonce = randomUUID().replace(/-/g, '').slice(0, 12)
    const coupleIds: string[] = []
    const weddingIds: string[] = []

    try {
      const couple = await db.couple.create({
        data: {
          slug: `uat-blocker-couple-${nonce}`,
          partner1: 'UAT One',
          partner2: 'UAT Two',
        },
      })
      coupleIds.push(couple.id)

      const wedding = await db.wedding.create({
        data: {
          slug: `uat-blocker-wedding-${nonce}`,
          title: 'UAT Blocker Wedding',
          date: new Date('2027-02-14T12:00:00.000Z'),
          venue: 'UAT Venue',
          venueCity: 'Harare',
          venueCountry: 'Zimbabwe',
          coupleId: couple.id,
        },
      })
      weddingIds.push(wedding.id)

      const table = await db.seatingTable.create({
        data: {
          weddingId: wedding.id,
          name: 'UAT Family Table',
          capacity: 6,
        },
      })

      const vendor = await db.vendor.create({
        data: {
          weddingId: wedding.id,
          name: 'UAT Golden Lens',
          category: 'photographer',
          contact: 'Tariro Vendor',
          contractStatus: 'signed',
          paymentStatus: 'partial',
          planningRating: 4.5,
          notes: 'Full normalized vendor write',
        },
      })
      const persistedVendor = await db.vendor.findUnique({ where: { id: vendor.id } })
      expect(persistedVendor).toMatchObject({
        contact: 'Tariro Vendor',
        contractStatus: 'signed',
        paymentStatus: 'partial',
        planningRating: 4.5,
        notes: 'Full normalized vendor write',
      })

      const timeline = await db.programmeItem.create({
        data: {
          weddingId: wedding.id,
          time: '14:30',
          title: 'UAT Ceremony Processional',
          description: 'Cue musicians',
          duration: '20 min',
          location: 'Main ceremony lawn',
          displayIcon: 'music',
        },
      })
      const persistedTimeline = await db.programmeItem.findUnique({ where: { id: timeline.id } })
      expect(persistedTimeline).toMatchObject({
        duration: '20 min',
        location: 'Main ceremony lawn',
        displayIcon: 'music',
      })

      const existingGuest = await db.guest.create({
        data: {
          weddingId: wedding.id,
          name: 'Original Legacy Name',
          email: 'original@example.com',
          phone: '+263700000001',
          role: 'family',
          side: 'bride',
        },
      })

      const updateRow = {
        'Guest ID': existingGuest.id,
        'First Name': 'Tariro',
        'Last Name': 'Updated',
        'Display Name': 'Tariro Updated',
        Email: 'updated@example.com',
        Phone: '+263700000002',
        'Family/Group': "Bride's Family",
        'Invitation Status': 'sent',
        'RSVP Status': 'attending',
        'Number Attending': '2',
        'Plus-One Name': 'Chipo Updated',
        'Number of Children': '1',
        Dietary: 'Vegetarian',
        Accessibility: 'Wheelchair access',
        Transport: 'Shuttle A',
        Accommodation: 'Rainbow Towers',
        'Table Assignment': table.name,
        'Seat Assignment': 'A1',
        'Public Notes': 'Public UAT note',
        'Private Notes': 'Private UAT note',
      }

      const updatePreview = await generatePreview(
        worksheetFile(updateRow),
        guestWorksheetSchema,
        wedding.id,
        'guest-update.xlsx',
      )
      expect(updatePreview.rows[0].action).toBe('update')
      expect(updatePreview.rows[0].existingId).toBe(existingGuest.id)

      const updateExecution = await executeGuestWorksheetImport(updatePreview, wedding.id)
      expect(updateExecution.result).toMatchObject({
        created: 0,
        updated: 1,
        skipped: 0,
        errors: 0,
      })

      const updatedGuest = await db.guest.findUnique({
        where: { id: existingGuest.id },
        include: { rsvp: true },
      })
      expect(updatedGuest).toMatchObject({
        name: 'Tariro Updated',
        email: 'updated@example.com',
        phone: '+263700000002',
        role: 'family',
        seatingTableId: table.id,
      })
      expect(updatedGuest?.rsvp).toMatchObject({
        attending: true,
        plusOne: true,
        plusOneName: 'Chipo Updated',
        kidsAttending: true,
        kidsCount: 1,
        dietaryNotes: 'Vegetarian',
      })

      const updatedRecord = (await fetchGuestWorksheetRecords(wedding.id))
        .find((record) => record.id === existingGuest.id)
      expect(updatedRecord).toBeTruthy()
      expect(guestWorksheetSchema.recordToRow(updatedRecord!)).toEqual({
        guestId: existingGuest.id,
        firstName: 'Tariro',
        lastName: 'Updated',
        displayName: 'Tariro Updated',
        email: 'updated@example.com',
        phone: '+263700000002',
        group: "Bride's Family",
        invitationStatus: 'sent',
        rsvpStatus: 'attending',
        numberAttending: '2',
        plusOneName: 'Chipo Updated',
        numberOfChildren: '1',
        dietary: 'Vegetarian',
        accessibility: 'Wheelchair access',
        transport: 'Shuttle A',
        accommodation: 'Rainbow Towers',
        tableAssignment: table.name,
        seatAssignment: 'A1',
        publicNotes: 'Public UAT note',
        privateNotes: 'Private UAT note',
      })

      const updateRollback = await rollbackGuestWorksheetImport(
        updateExecution.snapshot,
        wedding.id,
      )
      expect(updateRollback).toMatchObject({ deleted: 0, restored: 1, failed: 0 })

      const restoredGuest = await db.guest.findUnique({
        where: { id: existingGuest.id },
        include: { rsvp: true },
      })
      expect(restoredGuest).toMatchObject({
        name: 'Original Legacy Name',
        email: 'original@example.com',
        phone: '+263700000001',
        seatingTableId: null,
      })
      expect(restoredGuest?.rsvp).toBeNull()
      const restoredRecord = (await fetchGuestWorksheetRecords(wedding.id))
        .find((record) => record.id === existingGuest.id)
      expect(restoredRecord?.worksheet).toBeNull()

      const createRow = {
        'Display Name': 'No Email Idempotent Guest',
        Phone: '+263700000003',
        'Family/Group': 'Friends',
        'Invitation Status': 'confirmed',
        'RSVP Status': 'maybe',
        'Number Attending': '1',
        'Public Notes': 'Created from worksheet',
      }
      const createFile = worksheetFile(createRow)
      const createPreview = await generatePreview(
        createFile,
        guestWorksheetSchema,
        wedding.id,
        'guest-create.xlsx',
      )
      expect(createPreview.rows[0].action).toBe('create')

      const createExecution = await executeGuestWorksheetImport(createPreview, wedding.id)
      expect(createExecution.result).toMatchObject({
        created: 1,
        updated: 0,
        skipped: 0,
        errors: 0,
      })
      const createdGuestId = createExecution.snapshot.createdIds[0]
      expect(createdGuestId).toBeTruthy()

      const repeatPreview = await generatePreview(
        createFile,
        guestWorksheetSchema,
        wedding.id,
        'guest-create-repeat.xlsx',
      )
      expect(repeatPreview.rows[0].action).toBe('skip')
      expect(repeatPreview.newRecords).toBe(0)
      expect(repeatPreview.updateRecords).toBe(0)

      const createRollback = await rollbackGuestWorksheetImport(
        createExecution.snapshot,
        wedding.id,
      )
      expect(createRollback).toMatchObject({ deleted: 1, restored: 0, failed: 0 })
      expect(await db.guest.findUnique({ where: { id: createdGuestId } })).toBeNull()

      const secondCouple = await db.couple.create({
        data: {
          slug: `uat-blocker-couple-two-${nonce}`,
          partner1: 'Other One',
          partner2: 'Other Two',
        },
      })
      coupleIds.push(secondCouple.id)
      const secondWedding = await db.wedding.create({
        data: {
          slug: `uat-blocker-wedding-two-${nonce}`,
          title: 'Other Wedding',
          date: new Date('2027-03-01T12:00:00.000Z'),
          venue: 'Other Venue',
          venueCity: 'Harare',
          venueCountry: 'Zimbabwe',
          coupleId: secondCouple.id,
        },
      })
      weddingIds.push(secondWedding.id)
      const foreignGuest = await db.guest.create({
        data: {
          weddingId: secondWedding.id,
          name: 'Foreign Wedding Guest',
          role: 'guest',
        },
      })

      const foreignPreview = await generatePreview(
        worksheetFile({
          'Guest ID': foreignGuest.id,
          'Display Name': 'Foreign Wedding Guest',
        }),
        guestWorksheetSchema,
        wedding.id,
        'foreign-guest.xlsx',
      )
      expect(foreignPreview.rows[0].action).toBe('invalid')
      expect(foreignPreview.rows[0].errors.join(' ')).toContain('selected wedding')
    } finally {
      if (weddingIds.length) {
        await db.rSVP.deleteMany({
          where: { guest: { weddingId: { in: weddingIds } } },
        }).catch(() => undefined)
        await db.guest.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.seatingTable.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.vendor.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.programmeItem.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.wedding.deleteMany({ where: { id: { in: weddingIds } } }).catch(() => undefined)
      }
      if (coupleIds.length) {
        await db.couple.deleteMany({ where: { id: { in: coupleIds } } }).catch(() => undefined)
      }
    }
  })
})
