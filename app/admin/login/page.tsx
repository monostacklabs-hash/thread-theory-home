import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";
import { getSiteUrl } from "@/lib/hosts";

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
          <p>Sign in with your Google account. We&rsquo;ll keep you signed in on this device.</p>
          <LoginForm />
        </section>
        <p className="login-foot">
          {/* An absolute link: on the admin host "/" is the dashboard, not the shop. */}
          <a className="login-back" href={getSiteUrl()}>
            Back to Thread Theory Home
          </a>
        </p>
      </div>
    </main>
  );
}
