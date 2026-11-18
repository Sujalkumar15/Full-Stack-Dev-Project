import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email, password });
      const destination = (location.state as { from?: string } | null)?.from ?? "/workspaces";
      navigate(destination, { replace: true, state: { notice: "Welcome back. Your session is secure." } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your projects and team workspaces.">
      {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField id="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button type="submit" disabled={isSubmitting} className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-65">
          {isSubmitting ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />Signing in…</> : "Sign in securely"}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-500">New to Northstar? <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create your workspace</Link></p>
    </AuthLayout>
  );
}
