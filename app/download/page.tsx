import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Fieldnotes Workspace for macOS",
  description: "Download the Fieldnotes Workspace desktop app for Apple Silicon Macs.",
};

export default function DownloadPage() {
  const downloadUrl = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL;
  return (
    <main className="download-screen">
      <a className="download-brand" href="/">f<span>.</span> fieldnotes</a>
      <div className="download-card">
        <div className="download-icon">f<span>.</span></div>
        <p className="download-kicker">FIELDNOTES WORKSPACE</p>
        <h1>Ideas at home on your Mac.</h1>
        <p>Open your pages in a dedicated desktop window. Your notes stay synced through your Fieldnotes account and Turso storage.</p>
        {downloadUrl ? <a className="download-primary" href={downloadUrl}>Download for macOS · Apple Silicon</a> : <p className="download-pending">The macOS download is being prepared.</p>}
        <p className="download-detail">Requires macOS on an Apple Silicon Mac and an internet connection. This early installer uses an ad hoc signature and is not notarized; macOS may require you to approve opening it in Privacy &amp; Security.</p>
        <a className="download-web" href="/sign-in">Continue in browser →</a>
      </div>
    </main>
  );
}
