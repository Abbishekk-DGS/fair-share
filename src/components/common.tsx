import { useEffect, useRef, useState } from "react";
import { toMajorInput, toMinor } from "../lib/money";
import type { Person } from "../lib/types";

export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? [...parts[0]][0] + [...parts[1]][0] : [...parts[0]][0]).toUpperCase();
};

export const pc = (p: Person) => ({ "--c": `var(--p${p.color})` }) as React.CSSProperties;

export function Avatar({ person }: { person: Person }) {
  return (
    <span className="avatar" style={pc(person)} aria-hidden="true">
      {initials(person.name)}
    </span>
  );
}

/**
 * Number box for money. Keeps what the person is typing ("12.") while committing the parsed
 * value as they go. With `percentOf`, "5%" turns into 5% of that amount when they leave the box.
 */
export function MoneyInput(props: {
  value: number;
  currency: string;
  onChange: (minor: number) => void;
  percentOf?: number;
  className?: string;
  id?: string;
  label: string;
  placeholder?: string;
}) {
  const { value, currency, onChange, percentOf, className = "field right num", id, label, placeholder = "0" } = props;
  const [text, setText] = useState(value ? toMajorInput(value, currency) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? toMajorInput(value, currency) : "");
  }, [value, currency]);

  const commitPercent = (v: string) => {
    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (m && percentOf !== undefined) {
      const minor = Math.round((percentOf * parseFloat(m[1])) / 100);
      onChange(minor);
      setText(minor ? toMajorInput(minor, currency) : "");
      return true;
    }
    return false;
  };

  return (
    <input
      id={id}
      className={className}
      inputMode={percentOf !== undefined ? "text" : "decimal"}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (!/%/.test(v)) onChange(toMinor(v || "0", currency));
      }}
      onBlur={(e) => {
        focused.current = false;
        if (!commitPercent(e.target.value)) setText(value ? toMajorInput(value, currency) : "");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
