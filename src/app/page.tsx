import { redirect } from "next/navigation";

/** The product opens on the patient list. "/" exists so that URL still works. */
export default function HomePage() {
  redirect("/patients");
}
