import { requireChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import WorkspaceApp from "../components/workspace-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <WorkspaceApp userName={user.displayName} signOutPath={chatGPTSignOutPath("/")} />;
}
