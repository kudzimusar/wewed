from pathlib import Path

path = Path('src/lib/contributions-source-contract.test.ts')
if not path.exists():
    raise SystemExit('Generated Contributions source-contract test is missing.')

text = path.read_text()
replacements = {
    'expect(ui).toContain("value="overdue"")': 'expect(ui).toContain(\'value="overdue"\')',
    'expect(ui).toContain("value="unverified"")': 'expect(ui).toContain(\'value="unverified"\')',
    'expect(stage7).toContain("{ value: \'contributions\', label: \'Contributions\' }")': 'expect(stage7).toContain("{ value: \'contributions\', label: \'Contributions\', worksheetKey: \'contributions\' }")',
    'expect(campaign).toContain("[\'published\',\'showTarget\',\'showRaised\',\'invitationVisible\']")': 'expect(campaign).toContain("[\'published\',\'showTarget\',\'showRaised\',\'invitationVisible\',\'showContributorRecognition\']")',
    'expect(contributor).toContain("eventType:\'contributor.updated\'")': 'expect(contributor).toContain("action:\'contributor.updated\'")',
}

for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one generated contract assertion, found {count}: {old}')
    text = text.replace(old, new, 1)

path.write_text(text)

for forbidden in replacements:
    if forbidden in text:
        raise SystemExit(f'Stale generated assertion remains: {forbidden}')

print('Generated Contributions source-contract assertions normalized to hardened product.')
