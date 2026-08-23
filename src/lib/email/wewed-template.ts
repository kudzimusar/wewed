type WewedEmailMedia = {
  src: string
  alt: string
  width?: number
  height?: number
}

export type WewedTransactionalEmailTemplateInput = {
  eyebrow?: string
  title: string
  paragraphs: string[]
  ctaLabel?: string
  ctaHref?: string
  note?: string
  media?: WewedEmailMedia
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function renderWewedTransactionalEmail(input: WewedTransactionalEmailTemplateInput): string {
  const ctaHref = safeHttpUrl(input.ctaHref)
  const mediaSrc = safeHttpUrl(input.media?.src)
  const eyebrow = input.eyebrow ? escapeHtml(input.eyebrow) : ''
  const title = escapeHtml(input.title)
  const paragraphs = input.paragraphs
    .map((paragraph) => `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#3B2B22;">${escapeHtml(paragraph)}</p>`)
    .join('')
  const note = input.note
    ? `<tr><td style="padding-top:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F5EBDD" style="padding-top:12px;padding-right:14px;padding-bottom:12px;padding-left:14px;border-radius:10px;background-color:#F5EBDD;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#6E5A4B;">${escapeHtml(input.note)}</td></tr></table></td></tr>`
    : ''
  const cta = ctaHref && input.ctaLabel
    ? `<tr><td style="padding-top:8px;padding-bottom:8px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#BF9B5F" style="border-radius:10px;background-color:#BF9B5F;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding-top:13px;padding-right:22px;padding-bottom:13px;padding-left:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#241A15;text-decoration:none;">${escapeHtml(input.ctaLabel)}</a></td></tr></table></td></tr>`
    : ''
  const media = mediaSrc && input.media
    ? `<tr><td style="padding-bottom:20px;"><img src="${escapeHtml(mediaSrc)}" alt="${escapeHtml(input.media.alt)}" width="${input.media.width ?? 552}" height="${input.media.height ?? 276}" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:12px;" /></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title}</title>
</head>
<body bgcolor="#FBF7F0" style="margin:0;padding:0;background-color:#FBF7F0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FBF7F0" style="width:100%;background-color:#FBF7F0;">
<tr>
<td align="center" style="padding-top:24px;padding-right:12px;padding-bottom:24px;padding-left:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding-bottom:14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:32px;font-weight:600;color:#241A15;">Wewed</td></tr>
<tr><td bgcolor="#FFFFFF" style="padding-top:30px;padding-right:24px;padding-bottom:30px;padding-left:24px;border:1px solid #E8D8C2;border-radius:16px;background-color:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${eyebrow ? `<tr><td style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#9C7945;">${eyebrow}</td></tr>` : ''}
<tr><td style="padding-bottom:16px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;font-weight:600;color:#241A15;">${title}</td></tr>
${media}
<tr><td>${paragraphs}</td></tr>
${cta}
${note}
</table>
</td></tr>
<tr><td style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7B6A5D;">Need help? Reply to this email or visit <a href="https://wewed.pro" style="color:#7B5A2E;text-decoration:underline;">wewed.pro</a>.</td></tr>
<tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#9B8C81;">Wewed · Wedding planning, communication and collaboration in one place.</td></tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}
