from pathlib import Path

path = Path('scripts/contributions-installment-entry-taxonomy-uat.py')
text = path.read_text()

old = '''block = replace_once(block, "              amount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,", "              amount: paymentAmount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,", 'historical payment create amount')
block = replace_once(block, "              amount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,", "              amount: paymentAmount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,", 'new payment create amount')'''
new = '''create_amount_anchor = "              amount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,"
create_amount_replacement = "              amount: paymentAmount,\\n              currency,\\n              paidAt: fulfilledAt ?? now,"
if block.count(create_amount_anchor) != 2:
    raise SystemExit(f"payment create amount: expected 2 anchors, found {block.count(create_amount_anchor)}")
block = block.replace(create_amount_anchor, create_amount_replacement, 2)'''
if text.count(old) != 1:
    raise SystemExit(f'expected one duplicate-anchor block, found {text.count(old)}')
text = text.replace(old, new, 1)

old_error_anchor = "      PAYMENT_ALREADY_ATTRIBUTED: 'That payment is already fully attributed to a funding source.',"
current_error_anchor = "      PAYMENT_ALREADY_ATTRIBUTED: 'That vendor payment is already fully attributed to a funding source. Review its funding before adding another contributor.',"
if text.count(old_error_anchor) != 1:
    raise SystemExit(f'expected one stale error anchor, found {text.count(old_error_anchor)}')
text = text.replace(old_error_anchor, current_error_anchor, 1)

path.write_text(text)
print('Materializer anchors normalized for current main')
