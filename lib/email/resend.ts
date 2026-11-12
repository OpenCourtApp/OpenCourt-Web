import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInviteEmail({
  email,
  inviteUrl,
}: {
  email: string
  inviteUrl: string
}) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: 'Convite para acessar o OpenCourt',
    html: `
      <h1>Convite para acessar o OpenCourt</h1>
      <p>Você foi convidado a acessar o OpenCourt.</p>
      <p>
        <a href="${inviteUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">
          Aceitar convite
        </a>
      </p>
      <p>Se você não solicitou este convite, pode ignorar este e-mail.</p>
    `,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
