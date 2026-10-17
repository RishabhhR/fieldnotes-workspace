import { auth, currentUser } from "@clerk/nextjs/server";
import WorkspaceApp from "../components/workspace-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  const user = await currentUser();
  const userName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "My workspace";
  return <WorkspaceApp userName={userName} />;
}
