function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#003144]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
      />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between px-8 py-6">
        <div
          className="text-3xl tracking-tight text-white"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          optimizedLLM<sup className="text-xs">®</sup>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          <a
            href="#"
            className="text-sm text-white transition-colors hover:text-white"
          >
            Home
          </a>
          <a
            href="/models.html"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            Models
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            API
          </a>
          <a
            href="/docs.html"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            Docs
          </a>
          <a
            href="/pricing.html"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            Pricing
          </a>
        </div>

        <a
          href="/login.html"
          className="liquid-glass hidden cursor-pointer rounded-full px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03] md:block"
        >
          Begin Journey
        </a>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center px-6 pb-40 pt-32 text-center">
        <h1
          className="animate-fade-rise max-w-7xl text-5xl font-normal leading-[0.95] tracking-[-2.46px] text-white sm:text-7xl md:text-8xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Ship smarter.{' '}
          <em className="not-italic text-muted-foreground">Galaxy, one line away.</em>
        </h1>

        <a
          href="/login.html"
          className="animate-fade-rise-delay-2 liquid-glass mt-14 cursor-pointer rounded-full px-14 py-5 text-base text-white transition-transform hover:scale-[1.03]"
        >
          Begin Journey
        </a>
      </section>


    </div>
  )
}

export default App
