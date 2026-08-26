import { redirect } from "next/navigation";

// Root redirects to admin dashboard; exam URLs are at /exam/[slug]
export default function RootPage() {
  redirect("/admin/dashboard");
}
