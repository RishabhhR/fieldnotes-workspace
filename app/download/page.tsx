import type { Metadata } from "next";
import { DownloadView } from "./download-view";

export const metadata: Metadata = {
  title: "Get Fieldnotes — iPhone, Android & Mac",
  description: "Download or install Fieldnotes on your iPhone, iPad, Android phone, or Mac. Stay synced everywhere.",
};

export default function DownloadPage() {
  return (
    <DownloadView
      desktopDownloadUrl={process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL}
      iosAppStoreUrl={process.env.NEXT_PUBLIC_IOS_APP_STORE_URL}
      androidPlayStoreUrl={process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL}
      androidApkUrl={process.env.NEXT_PUBLIC_ANDROID_APK_URL}
    />
  );
}
