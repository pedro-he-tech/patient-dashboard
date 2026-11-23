import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That address is not part of the dashboard.
      </p>
      <Link
        href="/patients"
        className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to patients
      </Link>
    </div>
  );
}
