type PagePlaceholderProps = {
  title: string;
  description: string;
  empty: string;
};

/** Shared empty state for screens whose data views are not built yet. */
export function PagePlaceholder({
  title,
  description,
  empty,
}: PagePlaceholderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-8 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    </div>
  );
}
