const fs = require('fs')

async function main() {
  const archive = '/tmp/contributions-qualified-product.tar.gz'
  if (!fs.existsSync(archive)) throw new Error(`Missing archive: ${archive}`)
  const archiveBase64 = fs.readFileSync(archive).toString('base64')
  const textAttachment = Buffer.from(archiveBase64, 'utf8').toString('base64')
  const subject = 'Wewed Contributions qualified product transfer BASE64 2026-08-19'
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
      text: 'One-time Base64 text transfer of the already-qualified Contributions source archive. Decode the attached .b64.txt file to recover the original tar.gz.',
      attachments: [{ filename: 'contributions-qualified-product.tar.gz.b64.txt', content: textAttachment }],
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
