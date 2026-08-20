# Contributions partial-payment UAT patch

Production UAT for Charity & Kudzie exposed accounting-coherence gaps after the initial Contributions release.

This patch keeps one obligation coherent across Budget, Contributions, and vendor payments:

- pending direct-vendor support is worded as a promise, not a completed payment;
- pending unreconciled pledge amounts can be corrected before money moves;
- direct-vendor payments can be recorded in installments;
- summaries show promised, actually paid, and remaining separately;
- historical paid amounts can be classified partially across sources;
- the historical contribution selector only offers received, available contribution cash;
- Budget shows the live linked contribution state and notes instead of duplicating financial facts.

UAT target for the Cake record:

1. Actual 350 / Paid 100 / Couple-funded 100 / Outstanding 250.
2. Mazvita direct-vendor promise corrected from 350 to 250.
3. Before payment: Promised 250 / Paid direct 0 / Remaining 250.
4. First installment 100: Budget Paid 200 / Contributor-funded 100 / Outstanding 150 / Promise remaining 150.
5. Final installment 150: Budget Paid 350 / Contributor-funded 250 / Outstanding 0 / direct promise fulfilled.
