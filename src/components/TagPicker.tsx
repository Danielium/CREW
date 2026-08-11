"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { AVAILABLE_TAGS, MAX_TAGS, MAX_TAG_LENGTH } from "@/lib/club";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Preset chips plus an "add your own" chip that turns into the field when
 * pressed, so nothing extra sits on screen unused. Shared by club creation and
 * club editing: the two used to be the same markup and would have drifted.
 */
export default function TagPicker({ value, onChange }: TagPickerProps) {
  const [customTag, setCustomTag] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const isFull = value.length >= MAX_TAGS;

  // Hitting the cap hides the input, so anything half-typed would be stranded.
  useEffect(() => {
    if (isFull) {
      setCustomTag("");
      setIsAdding(false);
    }
  }, [isFull]);

  const toggleTag = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter(t => t !== tag));
    else if (!isFull) onChange([...value, tag]);
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (!tag || isFull) return;
    // Typing something that already exists picks it rather than creating a twin
    // that differs only by case.
    const existing = [...AVAILABLE_TAGS, ...value].find(t => t.toLowerCase() === tag.toLowerCase());
    if (existing) {
      if (!value.includes(existing)) onChange([...value, existing]);
    } else {
      onChange([...value, tag]);
    }
    setCustomTag("");
  };

  return (
    <div className="flex flex-wrap gap-2">
      {AVAILABLE_TAGS.map(tag => {
        const isSelected = value.includes(tag);
        const isBlocked = !isSelected && isFull;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            aria-pressed={isSelected}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              isSelected
                ? "bg-primary text-black border-primary"
                : isBlocked
                  ? "bg-card border-border text-muted/40"
                  : "bg-card border-border text-muted hover:border-muted"
            }`}
          >
            {tag}
          </button>
        );
      })}

      {/* Tags the founder invented: same chip, plus a way back out. */}
      {value.filter(t => !AVAILABLE_TAGS.includes(t)).map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          aria-label={`Убрать тег ${tag}`}
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all bg-primary text-black border-primary flex items-center gap-1.5"
        >
          {tag}
          <X size={13} strokeWidth={3} />
        </button>
      ))}

      {!isFull && (
        isAdding ? (
          <input
            type="text"
            autoFocus
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomTag(); setIsAdding(false); }
              if (e.key === "Escape") { setCustomTag(""); setIsAdding(false); }
            }}
            onBlur={() => { addCustomTag(); setIsAdding(false); }}
            maxLength={MAX_TAG_LENGTH}
            aria-label="Свой тег"
            placeholder="Свой тег"
            className="w-[130px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-primary bg-card text-foreground placeholder:text-muted placeholder:normal-case placeholder:tracking-normal placeholder:font-medium focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-dashed border-border text-muted hover:border-primary hover:text-primary transition-all flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={3} />
            Свой тег
          </button>
        )
      )}
    </div>
  );
}
