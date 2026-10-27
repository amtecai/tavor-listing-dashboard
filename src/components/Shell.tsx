import Link from 'next/link'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="nav">
        <div className="logo">
          <img className="word" src="/brand/wordmark.png" alt="Tavor Partners" />
          <img className="mark" src="/brand/symbol.png" alt="" />
        </div>
        <nav>
          <Link className="item active" href="/">Property summaries</Link>
        </nav>
        <p className="foot">Paste a listing, review the draft, export a PDF or a hosted link.</p>
      </aside>
      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  )
}
