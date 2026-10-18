import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="auth-screen">
      <div className="auth-brand">f<span>.</span> <strong>fieldnotes</strong></div>
      <SignUp />
      <a href="/download" className="auth-download">Get the app (iOS, Android, Mac)</a>
    </div>
  );
}
