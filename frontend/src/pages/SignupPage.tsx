import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { authApi } from "../api/authApi";

type SignupPageProps = {
  onSuccess: () => void;
  onLogin: () => void;
};

export function SignupPage({ onSuccess, onLogin }: SignupPageProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 3) nextErrors.name = "Use at least 3 characters for your username.";
    else if (!/^[a-zA-Z0-9_]+$/.test(form.name.trim())) nextErrors.name = "Use only letters, numbers, and underscores.";
    if (!form.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = "Use a valid email address.";
    if (form.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) nextErrors.confirm = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await authApi.register(form.name.trim(), form.email.trim(), form.password, form.confirm);
      onSuccess();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to create your account." });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const checkUsername = async () => {
    const username = form.name.trim();
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) return;
    setCheckingUsername(true);
    try {
      const result = await authApi.checkUsername(username);
      setErrors((current) => result.available
        ? (current.name === "Username is already taken" ? { ...current, name: "" } : current)
        : { ...current, name: "Username is already taken" });
    } catch {
      // Registration still performs the authoritative server-side check.
    } finally {
      setCheckingUsername(false);
    }
  };

  return (
    <motion.section className="auth-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="auth-art auth-art-signup" aria-hidden="true"><div className="india-outline">INDIA<br /><span>IS YOURS</span></div></div>
      <motion.div className="auth-card signup-card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
        <Brand />
        <div className="auth-heading">
          <span className="eyebrow">JOIN THE TABLE</span>
          <h1>Create your tycoon profile</h1>
          <p>Your account stays on this device—no server required.</p>
        </div>
        <form onSubmit={submit} noValidate>
          {(["name", "email", "password", "confirm"] as const).map((key) => {
            const labels = { name: "Your name", email: "Email address", password: "Password", confirm: "Confirm password" };
            const placeholders = { name: "Aarav Mehta", email: "you@example.com", password: "At least 8 characters", confirm: "Repeat your password" };
            return (
              <div key={key}>
                <label className="field-label" htmlFor={`signup-${key}`}>{labels[key]}</label>
                <div className={`input-shell ${errors[key] ? "input-error" : ""}`}>
                  <span aria-hidden="true">{key === "email" ? "✉" : key === "name" ? "●" : "◆"}</span>
                  <input id={`signup-${key}`} type={key === "password" || key === "confirm" ? "password" : key === "email" ? "email" : "text"} placeholder={placeholders[key]} value={form[key]} onChange={(event) => update(key, event.target.value)} onBlur={key === "name" ? checkUsername : undefined} />
                </div>
                {errors[key] && <p className="field-error">{errors[key]}</p>}
              </div>
            );
          })}
          {checkingUsername && <p className="field-error">Checking username...</p>}
          {errors.form && <p className="field-error">{errors.form}</p>}
          <motion.button className="button button-primary button-wide" disabled={submitting} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} type="submit">{submitting ? "Creating account..." : "Create account"} {!submitting && <span>→</span>}</motion.button>
        </form>
        <p className="auth-switch">Already have an account? <button type="button" onClick={onLogin}>Sign in</button></p>
      </motion.div>
    </motion.section>
  );
}
