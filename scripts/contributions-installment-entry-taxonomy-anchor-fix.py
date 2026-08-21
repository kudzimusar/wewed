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
path.write_text(text.replace(old, new, 1))
print('Materializer duplicate payment-create anchors normalized')
