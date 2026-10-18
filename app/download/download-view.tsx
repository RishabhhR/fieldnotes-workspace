"use client";

import { useState } from "react";
import Link from "next/link";
import { Smartphone, Laptop, Share, PlusSquare, Download, Check, ExternalLink, ArrowRight } from "lucide-react";
import { usePWA } from "@/lib/use-pwa";

interface DownloadViewProps {
  desktopDownloadUrl?: string;
  iosAppStoreUrl?: string;
  androidPlayStoreUrl?: string;
  androidApkUrl?: string;
}

export function DownloadView({
  desktopDownloadUrl,
  iosAppStoreUrl,
  androidPlayStoreUrl,
  androidApkUrl,
}: DownloadViewProps) {
  const { platform, canInstallNative, promptInstall, isInstalled } = usePWA();
  const [selectedTab, setSelectedTab] = useState<"ios" | "android" | "mac" | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const activeTab = selectedTab ?? (platform === "ios" ? "ios" : platform === "android" ? "android" : "mac");

  const handleAndroidInstall = async () => {
    setInstalling(true);
    const accepted = await promptInstall();
    setInstalling(false);
    if (accepted) {
      setInstallSuccess(true);
    }
  };

  return (
    <main className="download-screen">
      <header className="download-header">
        <Link className="download-brand" href="/">f<span>.</span> fieldnotes</Link>
        <Link className="download-web" href="/sign-in">Go to web workspace <ArrowRight size={14} /></Link>
      </header>

      <div className="download-card download-card-wide">
        <div className="download-icon">f<span>.</span></div>
        <p className="download-kicker">FIELDNOTES WORKSPACE</p>
        <h1>Your ideas, on every screen.</h1>
        <p>Take Fieldnotes with you on your iPhone, Android phone, or Mac. Pages and notes stay instantly synced across all devices.</p>

        <div className="download-device-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ios"}
            className={`device-tab-btn ${activeTab === "ios" ? "active" : ""}`}
            onClick={() => setSelectedTab("ios")}
          >
            <Smartphone size={16} /> iPhone &amp; iPad
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "android"}
            className={`device-tab-btn ${activeTab === "android" ? "active" : ""}`}
            onClick={() => setSelectedTab("android")}
          >
            <Smartphone size={16} /> Android
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "mac"}
            className={`device-tab-btn ${activeTab === "mac" ? "active" : ""}`}
            onClick={() => setSelectedTab("mac")}
          >
            <Laptop size={16} /> Mac
          </button>
        </div>

        <div className="device-tab-content">
          {activeTab === "ios" && (
            <div className="platform-detail-box">
              <h2>Install on iPhone &amp; iPad</h2>
              <p className="platform-subtext">Add Fieldnotes directly to your iOS Home Screen for a distraction-free, full-screen writing experience.</p>

              <div className="guide-steps">
                <div className="guide-step">
                  <div className="step-num"><Share size={15} /></div>
                  <div className="step-body">
                    <strong>1. Tap Share in Safari</strong>
                    <p>Open Fieldnotes in Safari and tap the Share button (square with arrow) at the bottom or top of your screen.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num"><PlusSquare size={15} /></div>
                  <div className="step-body">
                    <strong>2. Tap &ldquo;Add to Home Screen&rdquo;</strong>
                    <p>Scroll down in the action sheet and select <strong>Add to Home Screen</strong>.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num"><Check size={15} /></div>
                  <div className="step-body">
                    <strong>3. Tap &ldquo;Add&rdquo;</strong>
                    <p>Fieldnotes will appear right on your phone alongside your other apps, launching without browser toolbars.</p>
                  </div>
                </div>
              </div>

              {iosAppStoreUrl ? (
                <div className="download-btn-group">
                  <a className="download-primary" href={iosAppStoreUrl} target="_blank" rel="noopener noreferrer">
                    <Download size={16} /> Download on App Store <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                <div className="pwa-highlight-note">
                  ✨ No App Store download required — install instantly via Safari Add to Home Screen.
                </div>
              )}
            </div>
          )}

          {activeTab === "android" && (
            <div className="platform-detail-box">
              <h2>Install on Android</h2>
              <p className="platform-subtext">Install Fieldnotes on your Android phone or tablet for fast, full-screen app access.</p>

              {canInstallNative && !isInstalled && !installSuccess ? (
                <div className="native-install-hero">
                  <p>Your browser is ready to install the Fieldnotes application:</p>
                  <button
                    type="button"
                    className="download-primary install-action-btn"
                    onClick={handleAndroidInstall}
                    disabled={installing}
                  >
                    <Download size={16} /> {installing ? "Installing..." : "Install Fieldnotes App"}
                  </button>
                </div>
              ) : isInstalled || installSuccess ? (
                <div className="install-complete-banner">
                  <Check size={18} /> Fieldnotes is installed! You can now launch it from your home screen or app drawer.
                </div>
              ) : (
                <div className="guide-steps">
                  <div className="guide-step">
                    <div className="step-num">⋮</div>
                    <div className="step-body">
                      <strong>1. Open Chrome menu</strong>
                      <p>Tap the three dots (<strong>⋮</strong>) in the top-right corner of Chrome.</p>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-num"><Download size={15} /></div>
                    <div className="step-body">
                      <strong>2. Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;</strong>
                      <p>Choose the install option from the dropdown menu.</p>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-num"><Check size={15} /></div>
                    <div className="step-body">
                      <strong>3. Tap &ldquo;Install&rdquo;</strong>
                      <p>Fieldnotes will be added to your home screen and app drawer like a native app.</p>
                    </div>
                  </div>
                </div>
              )}

              {(androidPlayStoreUrl || androidApkUrl) && (
                <div className="download-btn-group">
                  {androidPlayStoreUrl && (
                    <a className="download-primary" href={androidPlayStoreUrl} target="_blank" rel="noopener noreferrer">
                      <Download size={16} /> Get on Google Play <ExternalLink size={14} />
                    </a>
                  )}
                  {androidApkUrl && (
                    <a className="download-secondary" href={androidApkUrl} download>
                      <Download size={16} /> Download Android APK
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "mac" && (
            <div className="platform-detail-box">
              <h2>Fieldnotes for macOS</h2>
              <p className="platform-subtext">Open your pages in a dedicated desktop window. Your notes stay synced through your Fieldnotes account and Turso storage.</p>

              {desktopDownloadUrl ? (
                <div className="download-btn-group">
                  <a className="download-primary" href={desktopDownloadUrl}>
                    <Download size={16} /> Download for macOS · Apple Silicon
                  </a>
                </div>
              ) : (
                <p className="download-pending">The macOS desktop installer is being prepared.</p>
              )}

              <p className="download-detail">
                Requires macOS on an Apple Silicon Mac and an internet connection. This early installer uses an ad hoc signature and is not notarized; macOS may require you to approve opening it in Privacy &amp; Security.
              </p>
            </div>
          )}
        </div>

        <div className="download-footer-links">
          <Link className="download-web" href="/sign-in">Continue in browser →</Link>
        </div>
      </div>
    </main>
  );
}
