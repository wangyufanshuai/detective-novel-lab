import { redirect } from "next/navigation";

/** The 3D Riverbend town is the main entry. The earlier workbench lives at /legacy. */
export default function Home() {
  redirect("/town-play");
}
