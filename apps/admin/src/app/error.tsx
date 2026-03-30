"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="bm-page">
      <section className="bm-card">
        <h2>Something went wrong</h2>
        <p className="bm-kv">Please retry this action.</p>
        <div className="bm-row">
          <button className="bm-btn bm-btn-primary" onClick={reset}>Try again</button>
        </div>
      </section>
    </main>
  );
}
