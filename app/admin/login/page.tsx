import type { Metadata } from "next";
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
        <section className="login-panel reveal">
          <span className="eyebrow">Admin Access</span>
          <div className="section-heading">
            <h2>Manage bookings without customer accounts.</h2>
            <p>
              Sign in with the Firebase admin account. Sessions are stored in a secure HTTP-only
              cookie after server-side validation.
            </p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
