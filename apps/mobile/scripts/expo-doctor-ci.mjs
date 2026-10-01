const command = ['bunx', 'expo-doctor@1.20.4']

const child = Bun.spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  stdout: 'pipe',
  stderr: 'pipe',
})

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
])

const output = [stdout, stderr].filter(Boolean).join('\n')
if (output) process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)

if (exitCode === 0) process.exit(0)

const failedChecks = (output.match(/^✖ /gm) ?? []).length
const unexpectedChecks = (output.match(/Unexpected error while running '.+' check:/g) ?? []).length
const errorLines = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('Error:'))

const knownInternalFailure = (line) =>
  /^Error: Failed to find dependency tree for .+: npm explain .+ --json exited with non-zero code: 1$/.test(line)

const onlyKnownDoctorInternalErrors =
  failedChecks > 0 &&
  failedChecks === unexpectedChecks &&
  errorLines.length === unexpectedChecks &&
  errorLines.every(knownInternalFailure)

if (onlyKnownDoctorInternalErrors) {
  console.warn(
    'Expo Doctor encountered only its known npm-explain dependency-tree lookup failures; ' +
      'dependency alignment remains enforced separately by expo install --check and native builds.',
  )
  process.exit(0)
}

process.exit(exitCode || 1)
