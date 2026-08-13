import LoginForm from "./login-form";
import { redirect } from "next/navigation";

import { getPageAuthorization } from "@/app/authorization";

export default async function LoginPage() {
  const authorization = await getPageAuthorization("operator");
  if (authorization.kind === "authorized") redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6"><LoginForm /></main>;
}
