"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Lock, User, Target, ChevronRight, Check, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { triggerHaptic } from "@/lib/haptics";
import Image from "next/image";

type Mode = "LOGIN" | "REGISTER_1" | "REGISTER_2" | "REGISTER_3" | "REGISTER_4";

const GOALS = [
  { id: "health", icon: "❤️", title: "Для здоровья", desc: "Поддерживать тонус и хорошее самочувствие" },
  { id: "weight", icon: "🔥", title: "Похудение", desc: "Сбросить лишний вес и стать стройнее" },
  { id: "marathon", icon: "🏃‍♂️", title: "Подготовка к гонке", desc: "Пробежать свой первый забег или улучшить время" },
  { id: "fun", icon: "✨", title: "Просто в кайф", desc: "Бегаю для себя, без строгих планов" },
];

export default function LoginPage() {
  const router = useRouter();
  const [rawMode, setRawMode] = useState<Mode>("LOGIN");
  
  const setMode = (newMode: Mode) => {
    triggerHaptic('light');
    setRawMode(newMode);
  };
  
  const mode = rawMode;
  
  // Form State
  const [telegramUsername, setTelegramUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [isTgLogin, setIsTgLogin] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        let tUsername = "";
        if (user.username) {
          tUsername = '@' + user.username;
        } else {
          tUsername = '@id' + user.id;
        }
        
        let tName = "";
        if (user.first_name) {
          tName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        }
        
        let tImage = user.photo_url || "";

        setTelegramUsername(tUsername);
        setName(tName);
        if (tImage) setImagePreview(tImage);
        setIsTgLogin(true);

        // Auto login bypass!
        setIsLoading(true);
        signIn("credentials", {
          telegramUsername: tUsername,
          password: "dummy_tg_auth",
          isTgWebApp: "true",
          name: tName,
          image: tImage,
          redirect: false,
        }).then((res) => {
          if (res?.ok) {
            router.push("/map");
            router.refresh();
          } else {
            setIsLoading(false);
          }
        });
      }
    }
  }, [router]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropImageSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (file: File, url: string) => {
    setImageFile(file);
    setImagePreview(url);
    setCropImageSrc(null);
  };
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        telegramUsername,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Неверный юзернейм или пароль");
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch (err) {
      setError("Произошла ошибка при входе");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckUsername = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!telegramUsername.trim() || !password.trim()) {
      setError("Введите Telegram username и пароль");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUsername }),
      });
      const data = await res.json();
      
      if (data.exists) {
        setError("Пользователь с таким юзернеймом уже существует");
      } else {
        if (isTgLogin) {
          setMode("REGISTER_4"); // Skip name & avatar
        } else {
          setMode("REGISTER_2");
        }
      }
    } catch (err) {
      setError("Ошибка при проверке юзернейма");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let uploadedImageUrl = null;
      if (imageFile) {
        // Конвертируем файл напрямую в Base64 (так как Vercel Serverless не поддерживает сохранение файлов)
        uploadedImageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const finalGoals = [...goals];
      if (customGoal.trim()) {
        finalGoals.push(customGoal.trim());
      }

      // Если есть файл, используем его, иначе используем tg URL из imagePreview
      const avatarStyle = uploadedImageUrl || imagePreview;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUsername, password, name, avatarStyle, goal: JSON.stringify(finalGoals) })
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Ошибка при регистрации");
        setIsLoading(false);
        return;
      }

      // Auto login after registration
      const loginRes = await signIn("credentials", {
        telegramUsername,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError("Аккаунт создан, но войти не удалось. Попробуйте войти вручную.");
        setMode("LOGIN");
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch (err) {
      setError("Произошла ошибка сети");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError("");
    if (mode === "LOGIN") return; // Nowhere to go back to since middleware enforces login
    if (mode === "REGISTER_2") setMode("LOGIN");
    if (mode === "REGISTER_3") setMode("REGISTER_2");
    if (mode === "REGISTER_4") setMode("REGISTER_3");
  };

  return (
    <div className="absolute inset-0 flex flex-col text-foreground p-6 bg-background z-50 overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex items-center mb-8 mt-14 z-10">
        {mode !== "LOGIN" ? (
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border text-muted hover:text-foreground transition-colors active:scale-95">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
        
        {mode !== "LOGIN" && (
          <div className="flex-1 flex justify-center items-center gap-2 pr-10">
            {[1, 2, 3, 4].map(step => (
              <div 
                key={step} 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  Number(mode.split('_')[1]) >= step ? 'w-8 bg-primary' : 'w-4 bg-border'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col z-10 min-h-0">
        {/* ======================================================== */}
        {/* LOGIN SCREEN */}
        {/* ======================================================== */}
        {mode === "LOGIN" && (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="mb-10">
              <h1 className="text-5xl font-black uppercase mb-4 leading-tight">Снова<br/><span className="text-primary">В деле</span></h1>
              <p className="text-muted">Войдите, чтобы продолжить свои тренировки.</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4 flex-1">
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm font-medium">{error}</div>}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted"><Send size={20} /></div>
                <input type="text" value={telegramUsername} onChange={(e) => setTelegramUsername(e.target.value)} placeholder="Telegram Username (@username)" required className="w-full bg-card border border-border rounded-[20px] py-4 pl-12 pr-4 text-foreground placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted"><Lock size={20} /></div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Придумайте пароль" required className="w-full bg-card border border-border rounded-[20px] py-4 pl-12 pr-4 text-foreground placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-foreground text-background font-black uppercase tracking-wider py-4 rounded-[20px] flex justify-center items-center mt-6 hover:bg-muted transition-all disabled:opacity-70 active:scale-95">
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : "Войти"}
              </button>

              <div className="mt-auto mb-8 text-center">
                <p className="text-muted mb-4">Впервые здесь?</p>
                <button type="button" disabled={isLoading} onClick={handleCheckUsername} className="w-full bg-primary text-black font-black uppercase tracking-wider py-4 rounded-[20px] flex justify-center items-center hover:bg-[#b3e600] active:scale-95 transition-all disabled:opacity-50">
                  {isLoading ? <Loader2 className="animate-spin" size={24} /> : "Создать аккаунт"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* REGISTER 2: NAME */}
        {/* ======================================================== */}
        {mode === "REGISTER_2" && (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="mb-10">
              <h1 className="text-4xl font-black uppercase mb-4 leading-tight">Как вас<br/>зовут?</h1>
              <p className="text-muted">Шаг 2 из 4. Это имя увидят другие бегуны в клубе.</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setMode("REGISTER_3"); }} className="flex flex-col gap-4 flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted"><User size={20} /></div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше Имя и Фамилия" required className="w-full bg-card border border-border rounded-[20px] py-4 pl-12 pr-4 text-foreground placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-xl font-semibold" autoFocus />
              </div>

              <button type="submit" className="w-full bg-primary text-black font-black uppercase tracking-wider py-4 rounded-[20px] flex justify-center items-center mt-auto mb-8 hover:bg-[#b3e600] active:scale-95 transition-all">
                Далее <ChevronRight size={20} className="ml-1" />
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* REGISTER 3: AVATAR */}
        {/* ======================================================== */}
        {mode === "REGISTER_3" && (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="mb-8">
              <h1 className="text-4xl font-black uppercase mb-4 leading-tight">Выбор<br/>Аватара</h1>
              <p className="text-muted">Шаг 3 из 4. Выберите стиль вашего профиля.</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-40 rounded-full border-4 border-primary bg-card overflow-hidden shadow-[0_0_30px_rgba(204,255,0,0.2)] cursor-pointer flex items-center justify-center relative group"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-muted">
                    <ImageIcon size={40} className="mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center px-4">Загрузить фото</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider">Изменить</span>
                </div>
                <input 
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                />
              </div>
              <p className="text-xs text-muted mt-6 text-center max-w-[250px]">
                Загрузите свое лучшее фото. Если пропустите этот шаг, будет использована стандартная аватарка.
              </p>
            </div>

            <button onClick={() => setMode("REGISTER_4")} className="w-full bg-primary text-black font-black uppercase tracking-wider py-4 rounded-[20px] flex justify-center items-center mt-4 mb-8 hover:bg-[#b3e600] active:scale-95 transition-all shrink-0">
              Далее <ChevronRight size={20} className="ml-1" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* REGISTER 4: GOAL & FINISH */}
        {/* ======================================================== */}
        {mode === "REGISTER_4" && (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="mb-8">
              <h1 className="text-4xl font-black uppercase mb-4 leading-tight">Главная<br/>Цель</h1>
              <p className="text-muted">Шаг 4 из 4. Зачем вы бегаете?</p>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col flex-1 min-h-0">
              {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm font-medium mb-4">{error}</div>}

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col gap-3">
                  {GOALS.map(g => (
                    <div 
                      key={g.id}
                      onClick={() => {
                        if (goals.includes(g.title)) {
                          setGoals(goals.filter(t => t !== g.title));
                        } else {
                          setGoals([...goals, g.title]);
                        }
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${goals.includes(g.title) ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-muted'}`}
                    >
                      <div className="text-3xl mr-4">{g.icon}</div>
                      <div className="flex-1">
                        <div className="font-bold text-lg">{g.title}</div>
                        <div className="text-xs text-muted leading-tight mt-1">{g.desc}</div>
                      </div>
                      {goals.includes(g.title) && <Check size={24} className="text-primary ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="mt-4 mb-8">
                  <input 
                    type="text" 
                    value={customGoal}
                    onChange={(e) => {
                      const val = e.target.value;
                      const words = val.trim().split(/\s+/).filter(w => w.length > 0);
                      if (words.length <= 3) {
                        setCustomGoal(val);
                      } else if (val.length < customGoal.length) {
                        setCustomGoal(val); // allow backspace
                      }
                    }}
                    placeholder="Или напишите свою (макс. 3 слова)" 
                    className="w-full bg-card border border-border rounded-[20px] py-4 px-4 text-foreground placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-semibold" 
                  />
                </div>

                <button type="submit" disabled={isLoading || (goals.length === 0 && !customGoal.trim())} className="w-full bg-primary text-black font-black uppercase tracking-wider py-4 rounded-[20px] flex justify-center items-center hover:bg-[#b3e600] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mt-8">
                  {isLoading ? <Loader2 className="animate-spin" size={24} /> : "Завершить и Войти"}
                </button>
                
                {/* Safari scroll padding hack: Safari ignores padding-bottom on scroll containers, so we use a dummy div */}
                <div className="h-32 shrink-0 w-full" aria-hidden="true" />
              </div>
            </form>
          </div>
        )}

      </div>

      {cropImageSrc && (
        <ImageCropperModal 
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onClose={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
