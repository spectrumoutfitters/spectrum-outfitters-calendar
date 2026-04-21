import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Setup Guide",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-sm font-bold text-amber-300">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-10">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="mt-3 space-y-3 text-sm text-neutral-300">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs font-mono text-amber-200">
      {children}
    </code>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full min-w-max text-left text-xs">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-neutral-400 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-900/60">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 font-mono text-neutral-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-xs text-amber-200">
      <code>{children}</code>
    </pre>
  );
}

export default function SetupPage() {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 lg:py-16">
        <div className="mb-10">
          <Link href="/" className="text-xs text-amber-300 hover:underline">← Home</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Setup Guide</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Get the raffle platform running
          </h1>
          <p className="mt-3 max-w-2xl text-base text-neutral-400">
            Follow these steps in order. Takes about 10 minutes. After setup, your raffle will be live at{" "}
            <Code>spectrumoutfitters.com/e/grand-opening</Code> and the admin panel at{" "}
            <Code>spectrumoutfitters.com/admin/grand-opening</Code>.
          </p>
        </div>

        <div className="relative border-l border-neutral-800 pl-0">
          {/* Step 1 */}
          <Step n={1} title="Create the Google Spreadsheet">
            <p>
              Go to <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">sheets.google.com</a> and
              create a new spreadsheet. Name it anything — e.g. <strong className="text-white">Spectrum Raffle</strong>.
            </p>
            <p>Create these four sheets (tabs) inside it:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><Code>Events</Code></li>
              <li><Code>Raffles</Code></li>
              <li><Code>Entries</Code></li>
              <li><Code>Winners</Code></li>
            </ul>
          </Step>

          {/* Step 2 */}
          <Step n={2} title="Add the Events sheet headers + grand-opening row">
            <p>In the <Code>Events</Code> sheet, set row 1 as headers and add the grand-opening event in row 2:</p>
            <Table
              headers={["Column", "Row 1 (header)", "Row 2 (grand-opening value)"]}
              rows={[
                ["A", "slug", "grand-opening"],
                ["B", "name", "Grand Opening Giveaway"],
                ["C", "description", "Celebrate with us! Multiple prizes up for grabs."],
                ["D", "logoUrl", "(leave blank or paste your logo URL)"],
                ["E", "primaryColor", "#c9a227"],
                ["F", "secondaryColor", "#1a1a1a"],
                ["G", "theme", "dark"],
                ["H", "active", "TRUE"],
                ["I", "defaultTestMode", "FALSE"],
                ["J", "adminKey", "choose-a-secret-password"],
                ["K", "blockTestWrite", "FALSE"],
              ]}
            />
            <p className="mt-2 text-neutral-400">
              The <Code>adminKey</Code> value is your password for the admin panel. Choose something secure and remember it.
            </p>
          </Step>

          {/* Step 3 */}
          <Step n={3} title="Add the Raffles sheet headers + prizes">
            <p>In the <Code>Raffles</Code> sheet, set row 1 as headers and add one row per prize:</p>
            <Table
              headers={["Column", "Row 1 (header)", "Example value"]}
              rows={[
                ["A", "slug", "grand-opening"],
                ["B", "raffleId", "prize-1"],
                ["C", "title", "Free Install Package"],
                ["D", "subtitle", "Worth up to $500 in labor"],
                ["E", "imageUrl", "(optional image URL)"],
                ["F", "sortOrder", "1"],
                ["G", "active", "TRUE"],
              ]}
            />
            <p className="mt-2 text-neutral-400">
              Add more rows (same <Code>slug</Code>, different <Code>raffleId</Code>) for additional prizes.
              People will see each prize as a card to pick from.
            </p>
          </Step>

          {/* Step 4 */}
          <Step n={4} title="Add Entries and Winners headers">
            <p>In the <Code>Entries</Code> sheet, add these headers in row 1 (the script writes data automatically):</p>
            <Block>
              {`timestamp | slug | name | phone | email | raffleId | bonusInstagram | bonusReview | bonusReferral | totalEntries | isTest | ip | userAgent`}
            </Block>
            <p>In the <Code>Winners</Code> sheet, add these headers in row 1:</p>
            <Block>
              {`drawId | timestamp | slug | raffleId | winnerName | winnerPhone | winnerEmail | ticketsInPool | isTest`}
            </Block>
          </Step>

          {/* Step 5 */}
          <Step n={5} title="Paste the Apps Script code and deploy">
            <p>
              In your spreadsheet, go to <strong className="text-white">Extensions → Apps Script</strong>.
              Delete any existing code, then paste the entire contents of:
            </p>
            <Code>raffle-platform/google-apps-script/Code.gs</Code>
            <p className="mt-3">Then deploy it as a web app:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Click <strong className="text-white">Deploy → New deployment</strong></li>
              <li>Type: <strong className="text-white">Web app</strong></li>
              <li>Execute as: <strong className="text-white">Me</strong></li>
              <li>Who has access: <strong className="text-white">Anyone</strong></li>
              <li>Click <strong className="text-white">Deploy</strong> and authorize</li>
              <li>Copy the <strong className="text-white">Web app URL</strong> (looks like <Code>https://script.google.com/macros/s/ABC.../exec</Code>)</li>
            </ol>
          </Step>

          {/* Step 6 */}
          <Step n={6} title="Create .env.local with your Apps Script URL">
            <p>
              In the <Code>raffle-platform/</Code> folder, create a file called <Code>.env.local</Code>:
            </p>
            <Block>
              {`APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID_HERE/exec`}
            </Block>
            <p>Replace the URL with the one you copied in step 5.</p>
          </Step>

          {/* Step 7 */}
          <Step n={7} title="Run the dev server">
            <p>Open a terminal, navigate to the <Code>raffle-platform/</Code> folder, and run:</p>
            <Block>{`npm install\nnpm run dev`}</Block>
            <p>Then open your browser and visit:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Entry page:{" "}
                <a href="http://localhost:3000/e/grand-opening" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">
                  localhost:3000/e/grand-opening
                </a>
              </li>
              <li>
                Admin panel:{" "}
                <a href="http://localhost:3000/admin/grand-opening" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">
                  localhost:3000/admin/grand-opening
                </a>
              </li>
            </ul>
          </Step>

          {/* Step 8 */}
          <Step n={8} title="Deploy to spectrumoutfitters.com">
            <p>The easiest way is <strong className="text-white">Vercel</strong>:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Push the <Code>raffle-platform/</Code> folder to a GitHub repo</li>
              <li>Go to <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">vercel.com</a> and import the repo</li>
              <li>Add <Code>APPS_SCRIPT_URL</Code> as an environment variable in Vercel's project settings</li>
              <li>Connect your custom domain <Code>spectrumoutfitters.com</Code> (or a subdomain like <Code>raffle.spectrumoutfitters.com</Code>) in Vercel</li>
            </ol>
            <p className="mt-3 text-neutral-400">
              Alternatively, add it as a subdirectory on your existing server using Next.js&apos;s{" "}
              <Code>basePath</Code> config option. Ask for help if you need this route.
            </p>
          </Step>

          {/* Step 9 */}
          <Step n={9} title="Test it end-to-end">
            <p>Visit your entry page and submit a test entry with <Code>?test=1</Code> appended to the URL:</p>
            <Block>{`spectrumoutfitters.com/e/grand-opening?test=1`}</Block>
            <p>Then open the admin panel, enter your admin key, and verify the entry appears in the stats. Try drawing a winner.</p>
            <p className="mt-2">
              When you're satisfied, remove <Code>?test=1</Code> from the URL and share the clean link with customers:{" "}
              <Code>spectrumoutfitters.com/e/grand-opening</Code>
            </p>
          </Step>
        </div>

        {/* Quick reference */}
        <div className="mt-2 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-base font-semibold text-white">Quick reference</h2>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Entry page (public)", "/e/grand-opening"],
              ["Admin panel", "/admin/grand-opening"],
              ["Test mode", "/e/grand-opening?test=1"],
              ["Official rules", "/legal/rules"],
              ["Terms", "/legal/terms"],
              ["Privacy policy", "/legal/privacy"],
            ].map(([label, path]) => (
              <div key={path} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-900 px-3 py-2">
                <span className="text-neutral-400">{label}</span>
                <code className="text-xs text-amber-200">{path}</code>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-neutral-500">
          Need to add more events? Add more rows to the <Code>Events</Code> and <Code>Raffles</Code> sheets with a new{" "}
          <Code>slug</Code>. Each slug gets its own URL automatically.
        </p>
      </div>
    </div>
  );
}
