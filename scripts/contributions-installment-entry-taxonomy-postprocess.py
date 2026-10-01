from pathlib import Path

path = Path('src/components/wedding/planner/planner-contributions-workspace.tsx')
text = path.read_text()
needle = "</Panel></div>{manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.expectedAt && manage.remainingAmount > 0 && <p className=\"mt-2 text-xs text-champagne/55\">Remaining payment due {new Date(manage.expectedAt).toLocaleDateString()}</p>} : <div className=\"mt-5 grid gap-3 sm:grid-cols-2\">"
if needle not in text:
    raise SystemExit('expected generated manage-panel boundary not found')
text = text.replace(needle, "</Panel></div> : <div className=\"mt-5 grid gap-3 sm:grid-cols-2\">", 1)
path.write_text(text)
print('Generated Contributions JSX boundary normalized')
