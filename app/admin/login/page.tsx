import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminLoginPage() {
  return (
    <main className="login-shell">
      <div className="container">
        <section className="login-panel reveal" aria-labelledby="admin-login-heading">
          <span className="panel-label">Admin</span>
          <h1 id="admin-login-heading">Sign in to manage bookings.</h1>
          <p>Sign in with your team account. We&rsquo;ll keep you signed in on this device.</p>
          <LoginForm />
        </section>
        <p className="login-foot">
          <Link className="login-back" href="/">
            Back to Thread Theory Home
          </Link>
        </p>
      </div>
    </main>
  );
}
