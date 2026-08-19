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

browser = Path('tests/e2e/planner-contributions.spec.ts')
if not browser.exists():
    raise SystemExit('Generated Contributions browser spec is missing.')

browser_text = browser.read_text()
malformed = "getByPlaceholder('Relationship, e.g. Bride's aunt')"
normalized = 'getByPlaceholder("Relationship, e.g. Bride\'s aunt")'
count = browser_text.count(malformed)
if count != 1:
    raise SystemExit(f'Expected exactly one malformed Contributions browser locator, found {count}.')
browser_text = browser_text.replace(malformed, normalized, 1)
browser.write_text(browser_text)
if malformed in browser_text:
    raise SystemExit('Malformed Contributions browser locator remains.')

stage7 = Path('src/components/wedding/planner-workspace-stage7.tsx')
if not stage7.exists():
    raise SystemExit('Generated Stage 7 Planner shell is missing.')
stage7_text = stage7.read_text()
selector = "data-testid={`worksheet-module-${module.worksheetKey ?? 'overview'}`}"
if stage7_text.count(selector) == 0:
    anchor = '                  key={module.value}\n                  type="button"\n                  onClick={() => selectWorkspaceTab(module.value)}'
    replacement = '                  key={module.value}\n                  type="button"\n                  data-testid={`worksheet-module-${module.worksheetKey ?? \'overview\'}`}\n                  onClick={() => selectWorkspaceTab(module.value)}'
    count = stage7_text.count(anchor)
    if count != 1:
        raise SystemExit(f'Expected exactly one Stage 7 module-button anchor, found {count}.')
    stage7_text = stage7_text.replace(anchor, replacement, 1)
    stage7.write_text(stage7_text)
if stage7_text.count(selector) != 1:
    raise SystemExit(f'Stage 7 worksheet module selector count must be exactly one, found {stage7_text.count(selector)}.')

print('Generated Contributions source/browser assertions normalized and Stage 10 selector preserved.')
