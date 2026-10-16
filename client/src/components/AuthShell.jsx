/** Shared frame for Sign in and Create account: form on the left, a short line about the app on the right. */
export default function AuthShell({ title, intro, children, aside }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {intro && <p className="mt-3 text-granite-700">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
      {aside && (
        <aside className="hidden self-start rounded-lg border border-granite-200 bg-surface p-7 lg:block">
          {aside}
        </aside>
      )}
    </section>
  );
}
