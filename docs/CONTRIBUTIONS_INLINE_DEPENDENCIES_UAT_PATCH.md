# Contributions inline dependency UAT patch

## UAT defect

A planner can begin recording a contribution and then discover that the matching Budget cost or Vendor / Service Engagement does not yet exist. The current form forces the planner to leave Contributions, create those records elsewhere, and then return. For a direct-vendor contribution the browser can also stop on the required service-engagement select with a generic validation message.

## Required behavior

Contributions must remain an orchestration surface over the canonical Planner records. It must not create parallel Budget or Vendor concepts.

1. A missing Budget item can be created inline from the open Add Contribution dialog through `/api/planner/budget`.
2. The inline Budget record starts with `paidAmount: 0`; a contribution promise or amount must never silently become Budget Paid.
3. A missing wedding Vendor can be created inline through `/api/planner/vendors`.
4. A missing Service Engagement can be created inline through `/api/planner/engagements` and linked to the selected canonical Budget item.
5. When a new engagement links a Budget item that has no vendor yet, the canonical Budget item inherits that engagement's vendor identity. Existing different-vendor links remain conflict protected.
6. The newly created Budget item and Service Engagement are automatically selected in the still-open contribution form.
7. A direct-vendor contribution gives plain-language prerequisite errors instead of the browser's generic `Please select an item in the list` dead end.
8. The planner must create/select the Budget cost before creating the inline Service Engagement so the three records are one accounting chain.
9. Creating setup records does not fabricate a vendor payment. The engagement is created with `payments: []`; money only moves when the contribution is actually recorded as paid.

## UAT acceptance

From Add Contribution, with neither the cost nor vendor/service previously configured:

- choose Direct vendor payment;
- click **Add budget item here**, create the cost, and verify it is selected without closing the contribution;
- click **Add vendor / service here**, create or choose the vendor and create the service, and verify it is selected without closing the contribution;
- save the contribution;
- verify Budget and Vendors show the same linked records rather than duplicate transactions;
- for a promise, Budget Paid stays unchanged until an actual vendor payment is later recorded.
