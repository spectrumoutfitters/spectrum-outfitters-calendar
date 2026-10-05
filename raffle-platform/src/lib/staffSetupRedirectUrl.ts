const DEFAULT_STAFF_APP = "https://login.spectrumoutfitters.com";

/** Staff setup UI lives on the calendar app. One trailing slash is removed before `/admin`. */
export function staffSetupRedirectUrl(staffAppUrl: string | undefined): string {
  const staff = staffAppUrl?.replace(/\/$/, "") || DEFAULT_STAFF_APP;
  return `${staff}/admin?raffleSetup=1`;
}
