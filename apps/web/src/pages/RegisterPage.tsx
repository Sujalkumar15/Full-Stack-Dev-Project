import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { ApiError } from "../lib/api";

type Fields = "name" | "email" | "password" | "workspaceName";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<Fields, string>>({ name: "", email: "", password: "", workspaceName: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Fields, string>>>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const errors: Partial<Record<Fields, string>> = {};
    if (form.name.trim().length < 2) errors.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid work email.";
    if (form.password.length < 8) errors.password = "Use at least 8 characters.";
    if (form.workspaceName.trim().length < 2) errors.workspaceName = "Enter a workspace name.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await register(form);
      navigate("/workspaces", { replace: true, state: { notice: "Your workspace is ready. Welcome to Northstar." } });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        const nextErrors: Partial<Record<Fields, string>> = {};
        for (const [key, messages] of Object.entries(caught.fieldErrors)) {
          if (["name", "email", "password", "workspaceName"].includes(key)) nextErrors[key as Fields] = messages[0];
        }
        setFieldErrors((current) => ({ ...current, ...nextErrors }));
      } else {
        setError("Unable to create your workspace right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const update = (field: Fields, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <AuthLayout title="Create your workspace" subtitle="Start with a private tenant for your team. You’ll be its owner.">
      {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="name" label="Your name" autoComplete="name" placeholder="Sujal Kumar" value={form.name} error={fieldErrors.name} onChange={(event) => update("name", event.target.value)} />
        <FormField id="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} error={fieldErrors.email} onChange={(event) => update("email", event.target.value)} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} error={fieldErrors.password} onChange={(event) => update("password", event.target.value)} />
        <FormField id="workspaceName" label="Workspace name" autoComplete="organization" placeholder="Acme Product Team" value={form.workspaceName} error={fieldErrors.workspaceName} onChange={(event) => update("workspaceName", event.target.value)} />
        <button type="submit" disabled={isSubmitting} className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-65">
          {isSubmitting ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />Creating workspace…</> : "Create workspace"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link></p>
    </AuthLayout>
  );
}
