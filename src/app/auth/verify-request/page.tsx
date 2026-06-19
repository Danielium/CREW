import Link from "next/link";
import { Mail } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <Mail className="w-20 h-20 text-primary mb-6 animate-bounce" />
      <h1 className="text-3xl font-bold uppercase mb-4 text-foreground">Проверьте почту</h1>
      <p className="text-muted mb-8 max-w-md">Мы отправили вам письмо со ссылкой для подтверждения. Пожалуйста, перейдите по ней, чтобы активировать аккаунт.</p>
      
      <p className="text-xs text-muted mb-8 max-w-md">Если вы не видите письма, проверьте папку "Спам" или "Рассылки".</p>
      
      <Link href="/login" className="w-full max-w-sm bg-card border border-border text-foreground py-4 rounded-2xl font-bold uppercase hover:bg-card/80 transition-colors">
        Вернуться к входу
      </Link>
    </div>
  );
}
