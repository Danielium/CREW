"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Loader2, Calendar, MapPin, Activity, Clock, Image as ImageIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import dynamic from 'next/dynamic';

const MapRouteBuilder = dynamic(() => import('@/components/MapRouteBuilder'), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-card border border-border rounded-[24px] flex items-center justify-center text-muted text-xs font-bold uppercase tracking-wider animate-pulse">Загрузка карты...</div>
});

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
    distance: "",
    image: "",
    routeData: null as string | null
  });
  const [paceFrom, setPaceFrom] = useState("");
  const [paceTo, setPaceTo] = useState("");
  const [isPaceToModified, setIsPaceToModified] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.event) {
          const ev = data.event;
          const d = new Date(ev.date);
          const dateStr = d.toISOString().split('T')[0];
          const timeStr = d.toTimeString().substring(0,5);
          
          let paces: string[] = [];
          try { paces = JSON.parse(ev.pace || "[]"); } catch(e) { paces = ev.pace ? [ev.pace] : []; }
          if (!Array.isArray(paces)) paces = [ev.pace];

          setForm({
            title: ev.title || "",
            description: ev.description || "",
            location: ev.location || "",
            date: dateStr,
            time: timeStr,
            distance: ev.distance ? ev.distance.toString() : "",
            image: ev.image || "",
            routeData: ev.routeData || null
          });
          if (paces.length > 0) {
            paces.sort();
            setPaceFrom(paces[0]);
            setPaceTo(paces[paces.length - 1]);
            if (paces[0] !== paces[paces.length - 1]) setIsPaceToModified(true);
          }
          setImagePreview(ev.image || null);
        }
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, [params.id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const dateTime = new Date(`${form.date}T${form.time}`).toISOString();
    let uploadedImageUrl = form.image;
    
    if (imageFile) {
      try {
        uploadedImageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      } catch (err) {
        console.error("Failed to upload image", err);
      }
    }

    try {
      const paces = [];
      if (paceFrom) paces.push(paceFrom);
      if (paceTo && paceTo !== paceFrom) paces.push(paceTo);

      const res = await fetch(`/api/events/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          location: form.location,
          date: dateTime,
          distance: form.distance,
          pace: paces,
          image: uploadedImageUrl,
          routeData: form.routeData
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        router.push("/");
      } else {
        alert(data.error || "Ошибка при обновлении события");
      }
    } catch (error) {
      alert("Сетевая ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24 relative z-10 flex flex-col">
      <div className="flex items-center gap-4 px-4 pb-4 pt-safe border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-20">
        <h1 className="text-xl font-black uppercase tracking-tight leading-none">Редактировать</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-6 max-w-md mx-auto w-full mt-4">
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Название события</label>
          <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
            <Activity size={18} className="text-primary" />
            <input 
              type="text"
              required
              placeholder="e.g. Sunday Long Run"
              className="bg-transparent border-none outline-none w-full font-medium"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Описание</label>
          <div className="bg-card border border-border rounded-2xl flex p-3 gap-3 focus-within:border-primary transition-colors">
            <textarea 
              placeholder="Расскажите подробнее о маршруте, темпе и ожиданиях..."
              className="bg-transparent border-none outline-none w-full font-medium resize-none min-h-[80px] text-sm"
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Точка сбора</label>
          <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
            <MapPin size={18} className="text-primary" />
            <input 
              type="text"
              required
              placeholder="ул. Ленина, д. 1"
              className="bg-transparent border-none outline-none w-full font-medium"
              value={form.location}
              onChange={(e) => setForm({...form, location: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Дата</label>
            <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors relative">
              <Calendar size={18} className="text-primary absolute left-3" />
              <input 
                type="date"
                required
                className="bg-transparent border-none outline-none w-full font-medium text-sm pl-8 appearance-none cursor-pointer"
                value={form.date}
                onChange={(e) => setForm({...form, date: e.target.value})}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Время</label>
            <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors relative">
              <Clock size={18} className="text-primary absolute left-3" />
              <input 
                type="time"
                required
                className="bg-transparent border-none outline-none w-full font-medium text-sm pl-8 appearance-none cursor-pointer"
                value={form.time}
                onChange={(e) => setForm({...form, time: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Обложка</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center h-48 gap-3 cursor-pointer hover:border-primary transition-colors relative overflow-hidden"
          >
            {imagePreview ? (
              <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Preview" />
            ) : (
              <ImageIcon size={32} className="text-muted" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider relative z-10">{imagePreview ? "Изменить обложку" : "Загрузить фото"}</span>
            <input 
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
          </div>
        </div>

        <MapRouteBuilder 
          initialRouteData={form.routeData}
          onDistanceChange={(dist) => {
             // Only update if it's an actual distance calculated by map or if form is empty
             if (dist !== "0.00" || form.distance === "") {
               setForm({...form, distance: dist});
             }
          }} 
          onRouteDataChange={(route) => setForm(prev => ({...prev, routeData: route}))} 
        />

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Ожидаемый Темп (мин/км)</label>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
               <span className="text-muted text-xs font-bold uppercase">ОТ</span>
               <input 
                 type="text" 
                 placeholder=":"
                 pattern="^\d{1,2}:[0-5]\d$"
                 title="Введите темп в формате ММ:СС (например, 5:30)"
                 maxLength={5}
                 className="bg-transparent border-none outline-none w-full font-medium"
                 value={paceFrom}
                 onChange={(e) => {
                   setPaceFrom(e.target.value);
                   if (!isPaceToModified) setPaceTo(e.target.value);
                 }}
               />
             </div>
             <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
               <span className="text-muted text-xs font-bold uppercase">ДО</span>
               <input 
                 type="text" 
                 placeholder=":"
                 pattern="^\d{1,2}:[0-5]\d$"
                 title="Введите темп в формате ММ:СС (например, 5:30)"
                 maxLength={5}
                 className="bg-transparent border-none outline-none w-full font-medium"
                 value={paceTo}
                 onChange={(e) => {
                   setPaceTo(e.target.value);
                   setIsPaceToModified(true);
                 }}
               />
             </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#b3e600] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Сохранить изменения"}
        </button>

      </form>
    </div>
  );
}
