import type { Metadata } from "next";
import { AdminHome } from "./admin-home";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminPage() {
  return <AdminHome />;
}
