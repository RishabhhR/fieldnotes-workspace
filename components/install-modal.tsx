"use client";

import { useState, useEffect } from "react";
import { X, Smartphone, Laptop, Share, PlusSquare, Download, Check, ExternalLink } from "lucide-react";
import { usePWA } from "@/lib/use-pwa";

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  desktopDownloadUrl?: string;
  iosAppStoreUrl?: string;
  androidPlayStoreUrl?: string;
  androidApkUrl?: string;
}

export function InstallModal({
  isOpen,
  onClose,
  desktopDownloadUrl = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL,
  iosAppStoreUrl = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL,
  androidPlayStoreUrl = process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL,
  androidApkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL,
}: InstallModalProps) {
  const { platform, canInstallNative, promptInstall, isInstalled } = usePWA();
  const [selectedTab, setSelectedTab] = useState<"ios" | "android" | "mac" | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const activeTab = selectedTab ?? (platform === "ios" ? "ios" : platform === "android" ? "android" : "mac");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    const accepted = await promptInstall();
    setInstalling(false);
    if (accepted) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
        setInstallSuccess(false);
      }, 1500);
    }
  };

  return (
    <div className="install-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="install-modal-title">
      <div className="install-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="install-modal-header">
          <div className="install-modal-title-group">
            <div className="brand-mark">f<span>.</span></div>
            <div>
              <h2 id="install-modal-title">Get Fieldnotes</h2>
              <p className="install-modal-subtitle">Install on your phone or computer for a distraction-free experience.</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="install-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ios"}
            className={`install-tab ${activeTab === "ios" ? "active" : ""}`}
            onClick={() => setSelectedTab("ios")}
          >
            <Smartphone size={16} /> iPhone &amp; iPad
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "android"}
            className={`install-tab ${activeTab === "android" ? "active" : ""}`}
            onClick={() => setSelectedTab("android")}
          >
            <Smartphone size={16} /> Android
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "mac"}
            className={`install-tab ${activeTab === "mac" ? "active" : ""}`}
            onClick={() => setSelectedTab("mac")}
          >
            <Laptop size={16} /> Mac
          </button>
        </div>

        <div className="install-content">
          {activeTab === "ios" && (
            <div className="platform-guide">
              <div className="guide-intro">
                <strong>Install directly to your iPhone or iPad:</strong>
                <p>Run Fieldnotes fullscreen with zero browser address bars, saved theme, and instant launch from your Home Screen.</p>
              </div>

              <div className="guide-steps">
                <div className="guide-step">
                  <div className="step-num"><Share size={15} /></div>
                  <div className="step-body">
                    <strong>1. Tap the Share button</strong>
                    <p>In Safari, tap the Share icon at the bottom (or top on iPad) of your screen.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num"><PlusSquare size={15} /></div>
                  <div className="step-body">
                    <strong>2. Select &ldquo;Add to Home Screen&rdquo;</strong>
                    <p>Scroll down in the share sheet and tap <strong>Add to Home Screen</strong>.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num"><Check size={15} /></div>
                  <div className="step-body">
                    <strong>3. Tap &ldquo;Add&rdquo;</strong>
                    <p>Confirm by tapping <strong>Add</strong> in the top-right corner. The Fieldnotes app icon will appear right on your home screen.</p>
                  </div>
                </div>
              </div>

              {iosAppStoreUrl && (
                <div className="external-download-row">
                  <a href={iosAppStoreUrl} target="_blank" rel="noopener noreferrer" className="download-primary">
                    <Download size={16} /> Download on the App Store <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "android" && (
            <div className="platform-guide">
              <div className="guide-intro">
                <strong>Install directly to your Android device:</strong>
                <p>Install Fieldnotes onto your device for standalone note-taking, fast startup, and native drawer access.</p>
              </div>

              {canInstallNative && !isInstalled && !installSuccess ? (
                <div className="native-install-box">
                  <p>Your browser is ready to install Fieldnotes with 1 tap:</p>
                  <button
                    type="button"
                    className="download-primary install-action-btn"
                    onClick={handleInstallClick}
                    disabled={installing}
                  >
                    <Download size={16} /> {installing ? "Installing..." : "Install Fieldnotes App"}
                  </button>
                </div>
              ) : isInstalled || installSuccess ? (
                <div className="install-complete-banner">
                  <Check size={18} /> Fieldnotes is installed! Check your home screen or app drawer.
                </div>
              ) : (
                <div className="guide-steps">
                  <div className="guide-step">
                    <div className="step-num">⋮</div>
                    <div className="step-body">
                      <strong>1. Open Chrome menu</strong>
                      <p>Tap the three vertical dots (<strong>⋮</strong>) in the top-right corner of Chrome.</p>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-num"><Download size={15} /></div>
                    <div className="step-body">
                      <strong>2. Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;</strong>
                      <p>Select the install option from the browser menu.</p>
                    </div>
                  </div>

                  <div className="guide-step">
                    <div className="step-num"><Check size={15} /></div>
                    <div className="step-body">
                      <strong>3. Tap &ldquo;Install&rdquo;</strong>
                      <p>Confirm the prompt. Fieldnotes will be added to your app drawer and home screen.</p>
                    </div>
                  </div>
                </div>
              )}

              {(androidPlayStoreUrl || androidApkUrl) && (
                <div className="external-download-row">
                  {androidPlayStoreUrl && (
                    <a href={androidPlayStoreUrl} target="_blank" rel="noopener noreferrer" className="download-primary">
                      <Download size={16} /> Get on Google Play <ExternalLink size={14} />
                    </a>
                  )}
                  {androidApkUrl && (
                    <a href={androidApkUrl} download className="download-secondary">
                      <Download size={16} /> Download APK
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "mac" && (
            <div className="platform-guide">
              <div className="guide-intro">
                <strong>Fieldnotes for macOS:</strong>
                <p>Run Fieldnotes in a dedicated desktop window with native keyboard shortcuts and synced Turso storage.</p>
              </div>

              {desktopDownloadUrl ? (
                <div className="mac-download-action">
                  <a href={desktopDownloadUrl} className="download-primary">
                    <Download size={16} /> Download for macOS · Apple Silicon
                  </a>
                  <p className="download-detail">Requires macOS on an Apple Silicon Mac. This early installer uses an ad hoc signature.</p>
                </div>
              ) : (
                <p className="download-pending">The macOS desktop download is being prepared.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
