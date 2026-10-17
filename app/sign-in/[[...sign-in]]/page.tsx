import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="auth-screen">
      <div className="auth-brand">f<span>.</span> <strong>fieldnotes</strong></div>
      <SignIn />
      <a href="/download" className="auth-download">Get the macOS app</a>
    </div>
  );
}
