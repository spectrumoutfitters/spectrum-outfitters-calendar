import { redirect } from "next/navigation";
import { staffSetupRedirectUrl } from "@/lib/staffSetupRedirectUrl";

export const dynamic = "force-dynamic";

/** Public setup UI moved to staff app (login.spectrumoutfitters.com → Admin → Grand Opening Day). */
export default function SetupRedirectPage() {
  redirect(staffSetupRedirectUrl(process.env.NEXT_PUBLIC_STAFF_APP_URL));
}
