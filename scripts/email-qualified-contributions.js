const fs = require('fs')
const path = require('path')

async function main() {
  const archive = '/tmp/contributions-qualified-product.tar.gz'
  if (!fs.existsSync(archive)) throw new Error(`Missing archive: ${archive}`)
  const content = fs.readFileSync(archive).toString('base64')
  const subject = 'Wewed Contributions qualified product transfer 2026-08-19'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Wewed Qualification <qualification@updates.wewed.pro>',
      to: ['kudzimusar@gmail.com'],
      subject,
      text: 'Automated one-time transfer of the already-qualified Contributions product tree. Public repository source only; no production data or credentials.',
      attachments: [{ filename: 'contributions-qualified-product.tar.gz', content }],
    }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Resend ${response.status}: ${body}`)
  console.log(`QUALIFIED_TRANSFER_SENT subject=${subject} response=${body}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
