import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const sendVerificationEmail = async (
  email: string, 
  token: string
) => {
  const confirmLink = `${domain}/auth/new-verification?token=${token}`;

  await resend.emails.send({
    from: "CREW <onboarding@resend.dev>", // Измените на свой домен после его привязки к Resend (например: hello@crew-app.ru)
    to: email,
    subject: "Подтвердите ваш email в CREW ⚡",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 20px; border-radius: 10px;">
        <h1 style="color: #CCFF00; margin-bottom: 20px; font-size: 24px; text-transform: uppercase;">Снова в деле!</h1>
        <p style="color: #aaa; font-size: 16px; margin-bottom: 30px;">
          Привет! Мы рады видеть тебя в CREW. Остался последний шаг — подтвердить твою почту.
        </p>
        <a href="${confirmLink}" style="background-color: #CCFF00; color: #000; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 12px; display: inline-block; text-transform: uppercase;">
          Подтвердить Email
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">
          Если ты не регистрировался в CREW, просто проигнорируй это письмо.
        </p>
      </div>
    `
  });
};
