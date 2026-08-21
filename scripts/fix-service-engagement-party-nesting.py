from pathlib import Path

service_path = Path('src/lib/contracts/phase2.ts')
test_path = Path('src/lib/contracts-phase2.test.ts')

service = service_path.read_text()
start = service.index('export async function createManagedServiceEngagement')
end = service.index('export async function listManagedServiceEngagements', start)
create_fn = service[start:end]

child_line = '              weddingId: input.weddingId,\n'
parent_line = '        weddingId: input.weddingId,\n'

count = create_fn.count(child_line)
if count != 3:
    raise SystemExit(f'Expected exactly 3 nested party weddingId fields; found {count}')
if parent_line not in create_fn:
    raise SystemExit('Parent ServiceEngagement weddingId is missing before patch')

create_fn = create_fn.replace(child_line, '')
if child_line in create_fn:
    raise SystemExit('Nested party weddingId remained after patch')
if parent_line not in create_fn:
    raise SystemExit('Parent ServiceEngagement weddingId was removed unexpectedly')

service = service[:start] + create_fn + service[end:]
service_path.write_text(service)

test = test_path.read_text()
marker = "  test('lets nested engagement parties inherit the parent wedding relation', () => {"
if marker not in test:
    regression = r'''

  test('lets nested engagement parties inherit the parent wedding relation', () => {
    const service = source('src/lib/contracts/phase2.ts')
    const start = service.indexOf('export async function createManagedServiceEngagement')
    const end = service.indexOf('export async function listManagedServiceEngagements', start)
    const create = service.slice(start, end)

    expect(create).toContain('        weddingId: input.weddingId,')
    expect(create).not.toContain('              weddingId: input.weddingId,')
    expect(create).toContain("partyRole: 'CLIENT'")
    expect(create).toContain("partyRole: 'PLANNER'")
    expect(create).toContain("partyRole: 'SERVICE_PROVIDER'")
  })
'''
    closing = test.rfind('\n})')
    if closing < 0:
        raise SystemExit('Could not find contracts-phase2 describe closing marker')
    test = test[:closing] + regression + test[closing:]
    test_path.write_text(test)

print('Service engagement nested-party fix materialized successfully.')
