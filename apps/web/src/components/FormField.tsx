import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, id, ...props }: FormFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 w-full rounded-xl border bg-white px-4 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-violet-100 ${error ? "border-rose-400" : "border-slate-200"}`} {...props} />
      {error ? <span id={`${id}-error`} className="mt-1.5 block text-sm text-rose-600">{error}</span> : null}
    </label>
  );
}
