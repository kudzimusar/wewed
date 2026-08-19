from pathlib import Path
import re

ROOT = Path('.')

TARGET_ROOTS = [
    ROOT / 'src/app/api/planner/contributions',
    ROOT / 'src/app/api/planner/contributors',
    ROOT / 'src/app/api/planner/contribution-campaigns',
    ROOT / 'src/app/api/planner/payments',
    ROOT / 'src/app/api/planner/budget',
]

changed = []
for root in TARGET_ROOTS:
    if not root.exists():
        continue
    for path in root.rglob('*.ts'):
        text = path.read_text()
        if 'auditEvent.create' not in text:
            continue
        original = text
        text = text.replace('eventType:', 'action:')
        text = text.replace('targetType:', 'resourceType:')
        text = text.replace('targetId:', 'resourceId:')
        text = text.replace('payload:', 'afterValue:')
        text = re.sub(r"\s*actorType\s*:\s*['\"]user['\"]\s*,\s*", ' ', text)
        text = re.sub(r",\s*severity\s*:\s*['\"][^'\"]+['\"]\s*", '', text)
        text = re.sub(r"\s*severity\s*:\s*['\"][^'\"]+['\"]\s*,\s*", ' ', text)
        if text != original:
            path.write_text(text)
            changed.append(str(path))

# Phase 2 generated one SQL interpolation with the JavaScript identifier NULL.
detail = ROOT / 'src/app/api/planner/contributions/[id]/route.ts'
if detail.exists():
    text = detail.read_text()
    bad = 'body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : NULL'
    if bad in text:
        detail.write_text(text.replace(bad, 'body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : null'))
        changed.append(str(detail))

# Fail closed if any Contributions-related Prisma AuditEvent write still uses fields not present in prisma/schema.prisma.
for root in TARGET_ROOTS:
    if not root.exists():
        continue
    for path in root.rglob('*.ts'):
        text = path.read_text()
        if 'auditEvent.create' not in text:
            continue
        for forbidden in ('eventType:', 'actorType:', 'targetType:', 'targetId:', 'payload:', 'severity:'):
            if forbidden in text:
                raise SystemExit(f'{path}: obsolete AuditEvent property remains: {forbidden}')

if detail.exists() and ': NULL' in detail.read_text():
    raise SystemExit(f'{detail}: JavaScript NULL identifier remains in generated contribution edit route.')

print('Wewed audit/schema contract normalization applied.')
for path in sorted(set(changed)):
    print(f'  normalized {path}')
