import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { authApi } from "../api/authApi";

type LoginPageProps = {
  onLogin: () => void;
  onSignup: () => void;
};

export function LoginPage({ onLogin, onSignup }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Use a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await authApi.login(email.trim(), password);
      if (remember) window.localStorage.setItem("india-tycoon-session", email.trim());
      onLogin();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to sign in." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.section className="auth-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="auth-art" aria-hidden="true">
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
        <div className="mini-card mini-card-a"><span>मुंबई</span><b>₹260</b></div>
        <div className="mini-card mini-card-b"><span>चेन्नई</span><b>₹350</b></div>
        <div className="floating-token">₹</div>
      </div>
      <motion.div className="auth-card" initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45 }}>
        <Brand />
        <div className="auth-heading">
          <span className="eyebrow">WELCOME BACK</span>
          <h1>Ready to make your move?</h1>
          <p>Sign in to enter India’s most ambitious property board.</p>
        </div>
        <form onSubmit={submit} noValidate>
          <label className="field-label" htmlFor="login-email">Email address</label>
          <div className={`input-shell ${errors.email ? "input-error" : ""}`}>
            <span aria-hidden="true">✉</span>
            <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {errors.email && <motion.p className="field-error" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>{errors.email}</motion.p>}

          <label className="field-label" htmlFor="login-password">Password</label>
          <div className={`input-shell ${errors.password ? "input-error" : ""}`}>
            <span aria-hidden="true">◆</span>
            <input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {errors.password && <motion.p className="field-error" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>{errors.password}</motion.p>}
          {errors.form && <p className="field-error">{errors.form}</p>}

          <div className="auth-options">
            <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label>
            <button type="button" className="text-button">Forgot password?</button>
          </div>
          <motion.button className="button button-primary button-wide" disabled={submitting} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} type="submit">{submitting ? "Signing in..." : "Enter the board"} {!submitting && <span>→</span>}</motion.button>
        </form>
        <p className="auth-switch">New to India Tycoon? <button type="button" onClick={onSignup}>Create an account</button></p>
      </motion.div>
    </motion.section>
  );
}
