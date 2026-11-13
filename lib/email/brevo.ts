export async function sendInviteEmail({
  email,
  inviteUrl,
}: {
  email: string
  inviteUrl: string
}) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: {
        name: 'OpenCourt',
        email: process.env.BREVO_FROM_EMAIL!,
      },
      to: [{ email }],
      subject: 'Convite para acessar o OpenCourt',
      htmlContent: `
        <html>
          <body>
            <h1>Convite para acessar o OpenCourt</h1>
            <p>Você foi convidado a acessar o OpenCourt.</p>
            <p>
              <a href="${inviteUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">
                Aceitar convite
              </a>
            </p>
            <p>Se você não solicitou este convite, pode ignorar este e-mail.</p>
          </body>
        </html>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo ${res.status}: ${body}`)
  }

  return await res.json()
}
