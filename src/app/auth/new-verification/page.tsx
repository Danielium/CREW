import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

export default async function NewVerificationPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  let isSuccess = false;
  let message = "";

  if (!token) {
    message = "Токен не найден.";
  } else {
    // Найти токен
    const existingToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!existingToken) {
      message = "Неверный токен или он уже был использован.";
    } else {
      const hasExpired = new Date(existingToken.expires) < new Date();

      if (hasExpired) {
        message = "Срок действия ссылки истек. Зарегистрируйтесь заново.";
      } else {
        // Подтверждаем пользователя
        const existingUser = await prisma.user.findUnique({
          where: { email: existingToken.identifier },
        });

        if (!existingUser) {
          message = "Пользователь с таким email не найден.";
        } else {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          });

          // Удаляем токен
          await prisma.verificationToken.delete({
            where: { identifier_token: { identifier: existingToken.identifier, token: existingToken.token } },
          });
          isSuccess = true;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      {isSuccess ? (
        <>
          <CheckCircle className="w-20 h-20 text-primary mb-6 animate-pulse" />
          <h1 className="text-3xl font-bold uppercase mb-4 text-foreground">Почта подтверждена!</h1>
          <p className="text-muted mb-8">Теперь вы можете войти в свой аккаунт и присоединиться к Crew.</p>
          <Link href="/login" className="w-full max-w-sm bg-primary text-black py-4 rounded-2xl font-bold uppercase hover:bg-primary/90 transition-colors">
            Войти в аккаунт
          </Link>
        </>
      ) : (
        <>
          <XCircle className="w-20 h-20 text-red-500 mb-6" />
          <h1 className="text-3xl font-bold uppercase mb-4 text-foreground">Ошибка</h1>
          <p className="text-muted mb-8">{message}</p>
          <Link href="/login" className="w-full max-w-sm bg-card border border-border text-foreground py-4 rounded-2xl font-bold uppercase hover:bg-card/80 transition-colors">
            Вернуться на главную
          </Link>
        </>
      )}
    </div>
  );
}
