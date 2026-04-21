import type { Metadata } from "next";
import { AdminDashboardClient } from "@/components/raffle/AdminDashboardClient";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: `Admin · ${slug}` };
}

export default async function AdminPage(props: PageProps) {
  const { slug } = await props.params;
  return <AdminDashboardClient slug={slug} />;
}
