import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Public setup UI moved to staff app (login.spectrumoutfitters.com → Admin → Grand Opening Day). */
export default function SetupRedirectPage() {
  const staff =
    process.env.NEXT_PUBLIC_STAFF_APP_URL?.replace(/\/$/, "") ||
    "https://login.spectrumoutfitters.com";
  redirect(`${staff}/admin?raffleSetup=1`);
}
