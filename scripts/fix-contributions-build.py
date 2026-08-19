from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ui_path = ROOT / 'src/components/wedding/planner/planner-contributions-workspace.tsx'
ui = ui_path.read_text()
start_marker = '      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">\n'
end_marker = '      {(workspace?.summaryByCurrency ?? []).some((summary) => summary.pledged > 0)'
start = ui.index(start_marker)
end = ui.index(end_marker, start)
replacement = '''      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">\n        {(workspace?.summaryByCurrency ?? []).length === 0 ? (\n          <Panel className="col-span-2 p-4 lg:col-span-4">\n            <p className="text-sm text-champagne/55">No contributions yet. Add the first person, family or organisation that helped.</p>\n          </Panel>\n        ) : (\n          workspace!.summaryByCurrency.flatMap((summary) => {\n            const cards = [\n              { label: 'Money received', value: summary.cashReceived, detail: 'Cash given to you', Icon: CircleDollarSign },\n              { label: 'Paid direct', value: summary.directVendorPaid, detail: 'Paid straight to a vendor', Icon: Store },\n              { label: 'In-kind value', value: summary.inKindValue, detail: 'Estimated non-cash help', Icon: Gift },\n              { label: 'Still available', value: summary.availableCash, detail: 'Received cash not yet allocated', Icon: HandHeart },\n            ]\n            return cards.map(({ label, value, detail, Icon }) => (\n              <Panel key={`${summary.currency}-${label}`} className="p-3 sm:p-4">\n                <div className="flex items-center justify-between text-gold">\n                  <p className="text-[9px] uppercase tracking-[0.12em] sm:text-[10px]">{label}</p>\n                  <Icon className="size-4" />\n                </div>\n                <p className="mt-2 font-serif text-xl sm:text-2xl">{money(value, summary.currency)}</p>\n                <p className="mt-1 text-[10px] leading-4 text-champagne/45">{detail} · {summary.currency}</p>\n              </Panel>\n            ))\n          })\n        )}\n      </div>\n'''
ui = ui[:start] + replacement + ui[end:]
ui_path.write_text(ui)

route_path = ROOT / 'src/app/api/planner/contributions/route.ts'
route = route_path.read_text()
start_marker = "      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {"
end_marker = '\n\n      await tx.auditEvent.create'
start = route.index(start_marker)
end = route.index(end_marker, start)
replacement = '''      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {\n        const paymentReference = String(body.paymentReference ?? '').trim() || null\n        const historicalPaidAlreadyRecorded = body.alreadyIncludedInBudgetPaid === true\n        let payment\n\n        if (historicalPaidAlreadyRecorded) {\n          const candidates = await tx.engagementPayment.findMany({\n            where: {\n              serviceEngagementId,\n              currency,\n              amount,\n              ...(paymentReference ? { reference: paymentReference } : {}),\n            },\n            orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],\n          })\n          if (candidates.length > 1) throw new Error('PAYMENT_MATCH_AMBIGUOUS')\n          payment = candidates[0] ?? await tx.engagementPayment.create({\n            data: {\n              serviceEngagementId,\n              amount,\n              currency,\n              paidAt: fulfilledAt ?? now,\n              method: String(body.paymentMethod ?? '').trim() || null,\n              reference: paymentReference,\n              notes: `Historical contributor-funded payment recorded during Contributions reconciliation: ${String(body.title).trim()}`,\n              recordedById: actorId,\n            },\n          })\n        } else {\n          payment = await tx.engagementPayment.create({\n            data: {\n              serviceEngagementId,\n              amount,\n              currency,\n              paidAt: fulfilledAt ?? now,\n              method: String(body.paymentMethod ?? '').trim() || null,\n              reference: paymentReference,\n              notes: `Contributor-funded payment: ${String(body.title).trim()}`,\n              recordedById: actorId,\n            },\n          })\n        }\n\n        const existingFundingRows = await tx.$queryRaw<Array<{ total: string }>>`\n          SELECT COALESCE(SUM(amount), 0)::text AS total\n            FROM wewed_contributions.payment_funding_allocations\n           WHERE wedding_id = ${weddingId}\n             AND payment_id = ${payment.id}\n             AND currency = ${currency}\n        `\n        const existingFunding = Number(existingFundingRows[0]?.total ?? 0)\n        if (existingFunding + amount > Number(payment.amount) + 0.0001) throw new Error('PAYMENT_ALREADY_ATTRIBUTED')\n\n        await tx.$executeRaw`\n          INSERT INTO wewed_contributions.payment_funding_allocations\n            (id, wedding_id, payment_id, budget_item_id, contribution_id, source_kind, amount, currency, created_by_id, reconciled_at)\n          VALUES\n            (${contributionId()}, ${weddingId}, ${payment.id}, ${budgetItemId}, ${contributionIdValue}, 'CONTRIBUTION', ${amount}, ${currency}, ${actorId}, ${now})\n        `\n        if (budgetItemId && !historicalPaidAlreadyRecorded) {\n          await tx.budgetItem.update({ where: { id: budgetItemId }, data: { paidAmount: { increment: amount } } })\n        }\n        await tx.$executeRaw`\n          UPDATE wewed_contributions.wedding_contributions\n             SET verification_state = 'RECONCILED', updated_at = NOW()\n           WHERE id = ${contributionIdValue}\n        `\n      }'''
route = route[:start] + replacement + route[end:]
route = route.replace(
    "      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'A direct vendor payment must be connected to the vendor service engagement.',",
    "      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'A direct vendor payment must be connected to the vendor service engagement.',\n      PAYMENT_MATCH_AMBIGUOUS: 'More than one existing vendor payment matches this historical contribution. Add the exact payment reference or reconcile the payment separately.',\n      PAYMENT_ALREADY_ATTRIBUTED: 'That vendor payment is already fully attributed to a funding source. Review its funding before adding another contributor.',",
)
route_path.write_text(route)

# Strengthen the source contract around historical payment reuse.
test_path = ROOT / 'src/lib/contributions-source-contract.test.ts'
test = test_path.read_text()
test = test.replace(
    "    expect(route).toContain('alreadyIncludedInBudgetPaid')",
    "    expect(route).toContain('alreadyIncludedInBudgetPaid')\n    expect(route).toContain('PAYMENT_MATCH_AMBIGUOUS')\n    expect(route).toContain('existingFundingRows')",
)
test_path.write_text(test)

print('Applied Contributions build and historical-payment reconciliation fixes.')
