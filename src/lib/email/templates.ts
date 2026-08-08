import { publicUrl } from '@/lib/public-origin'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f4ef;color:#201f1d;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7e0d7;border-radius:14px;padding:32px;">
        <p style="margin:0 0 18px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#76695c;">Wewed</p>
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
        ${body}
      </div>
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#756f68;">
        This transactional message was sent by Wewed. Links in this email return to https://wewed.pro.
      </p>
    </div>
  </body>
</html>`
}

export function registrationReceivedEmail(input: {
  name: string
  businessName: string
  applicationId: string
}) {
  const name = escapeHtml(input.name)
  const businessName = escapeHtml(input.businessName)
  const applicationId = escapeHtml(input.applicationId)
  const returnUrl = publicUrl('/register')
  const subject = 'We received your Wewed application'

  const text = [
    `Hello ${input.name},`,
    '',
    `We received the Wewed application for ${input.businessName}.`,
    `Application reference: ${input.applicationId}`,
    '',
    'Your application is pending review. Complete any separate email-confirmation step sent by Wewed authentication if requested.',
    '',
    `Return to Wewed: ${returnUrl}`,
  ].join('\n')

  const html = shell(
    subject,
    `<p style="font-size:16px;line-height:1.65;">Hello ${name},</p>
     <p style="font-size:16px;line-height:1.65;">We received the Wewed application for <strong>${businessName}</strong>.</p>
     <p style="font-size:15px;line-height:1.65;"><strong>Application reference:</strong> ${applicationId}</p>
     <p style="font-size:15px;line-height:1.65;">Your application is pending review. Complete any separate email-confirmation step sent by Wewed authentication if requested.</p>
     <p style="margin-top:26px;"><a href="${returnUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#201f1d;color:#ffffff;text-decoration:none;">Return to Wewed</a></p>`,
  )

  return { subject, text, html }
}
