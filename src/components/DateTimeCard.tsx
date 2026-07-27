"use client";
import { Calendar, Clock } from "lucide-react";

export function DateTimeCard({ date, time, onDate, onTime, minDate }: { date: string; time: string; onDate: (v: string) => void; onTime: (v: string) => void; minDate?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl flex items-stretch divide-x divide-border overflow-hidden">
      <div className="flex-1 flex items-center gap-2 p-3 relative focus-within:bg-primary/5 transition-colors">
        <Calendar size={16} className="text-primary shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          min={minDate}
          required
          className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer"
        />
      </div>
      <div className="flex-1 flex items-center gap-2 p-3 relative focus-within:bg-primary/5 transition-colors">
        <Clock size={16} className="text-primary shrink-0" />
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          required
          className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer"
        />
      </div>
    </div>
  );
}
