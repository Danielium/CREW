"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, MapPin, Activity, Image as ImageIcon, Clock, Eye, EyeOff } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { uploadImage } from "@/lib/uploadImage";
import dynamic from 'next/dynamic';
import { DateTimeCard } from "@/components/DateTimeCard";
import { PaceRangeSlider, formatPace, parsePaceRange } from "@/components/PaceRangeSlider";

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
    routeData: null as string | null,
    showOnMap: false
  });
  const [paceFrom, setPaceFrom] = useState(5);
  const [paceTo, setPaceTo] = useState(6);
  const [paceAny, setPaceAny] = useState(true);

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

          setForm({
            title: ev.title || "",
            description: ev.description || "",
            location: ev.location || "",
            date: dateStr,
            time: timeStr,
            distance: ev.distance ? ev.distance.toString() : "",
            image: ev.image || "",
            routeData: ev.routeData || null,
            showOnMap: ev.showOnMap ?? false
          });

          if (ev.pace) {
            const [pFrom, pTo] = parsePaceRange(ev.pace);
            setPaceFrom(pFrom);
            setPaceTo(pTo);
            setPaceAny(false);
          } else {
            setPaceAny(true);
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
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        uploadedImageUrl = uploadedUrl;
      } else {
        alert("Ошибка при загрузке изображения");
        setIsLoading(false);
        return;
      }
    }

    try {
      const paces = paceAny ? [] : [formatPace(paceFrom), formatPace(paceTo)];

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
          routeData: form.routeData,
          showOnMap: form.showOnMap
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
        <h1 className="text-xl font-bold uppercase tracking-normal leading-none font-display">Редактировать</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-6 max-w-md mx-auto w-full mt-4">

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Название события</label>
          <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
            <Activity size={18} className="text-primary" />
            <input
              type="text"
              required
              placeholder="Придумайте название забега"
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
          onAddressFound={(address) => setForm(prev => ({...prev, location: address}))}
        />

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Точка сбора</label>
          <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
            <MapPin size={18} className="text-primary" />
            <input
              type="text"
              required
              placeholder="Адрес"
              className="bg-transparent border-none outline-none w-full font-medium"
              value={form.location}
              onChange={(e) => setForm({...form, location: e.target.value})}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4 flex items-center gap-2">
            <Clock size={16} /> Дата и время старта
          </label>
          <DateTimeCard
            date={form.date}
            time={form.time}
            onDate={(v) => setForm({...form, date: v})}
            onTime={(v) => setForm({...form, time: v})}
          />
        </div>

        <PaceRangeSlider
          from={paceFrom}
          to={paceTo}
          onChange={(f, t) => { setPaceFrom(f); setPaceTo(t); }}
          paceAny={paceAny}
          onPaceAnyChange={setPaceAny}
        />

        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl cursor-pointer" onClick={() => setForm(prev => ({...prev, showOnMap: !prev.showOnMap}))}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${form.showOnMap ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {form.showOnMap ? <Eye size={20} /> : <EyeOff size={20} />}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">Показывать на общей карте</span>
              <span className="text-xs text-muted-foreground">Если выключено, пробежку увидят только в клубе</span>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${form.showOnMap ? 'bg-primary' : 'bg-border'}`}>
            <div className={`w-5 h-5 bg-background rounded-full absolute transition-all ${form.showOnMap ? 'left-[26px]' : 'left-[2px]'}`}></div>
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
