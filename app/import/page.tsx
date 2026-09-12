import { redirect } from "next/navigation";
import { ImportView } from "@/components/import/import-view";
import { getSessionUser } from "@/lib/auth/session";

export default async function ImportPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?next=%2Fimport");
  }

  return <ImportView />;
}
