import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faBrain, faBars, faArrowRight, faServer, faCloudArrowDown, faLock, faStar, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Marquee from '@/components/Marquee'
import ThreeBackground from '@/components/ThreeBackground'
import ModelsPage from '@/components/ModelsPage'

const MODELS = [
  { id: 'moonshotai/kimi-k2.6', desc: 'Moonshot AI Kimi K2 — long-context, coding, and reasoning.', badge: 'kimi', bg: 'bg-nb-lime/30' },
  { id: 'minimax/minimax-01', desc: 'MiniMax 01 — general-purpose language capabilities.', badge: 'minimax', bg: 'bg-nb-pink/30' },
  { id: 'zhipu/glm-4', desc: 'Zhipu GLM-4 — multilingual, coding, and instruction-tuned.', badge: 'glm', bg: 'bg-nb-blue/20' },
  { id: 'deepseek-ai/deepseek-chat', desc: 'DeepSeek Chat — latest general-purpose reasoning model.', badge: 'deepseek', bg: 'bg-nb-yellow/30' },
]

const FEATURES = [
  { icon: faBolt, title: 'OpenAI Compatible', desc: 'Drop-in replacement. Use your existing codebase, just change the base URL.' },
  { icon: faBrain, title: '100+ Models', desc: 'Full NVIDIA NIM catalog. Language, vision, code, embedding — one API.' },
  { icon: faServer, title: 'Streaming Native', desc: 'Native SSE streaming. Receive tokens as they are generated in real-time.' },
  { icon: faCloudArrowDown, title: 'Free Tier', desc: 'Start with 100K free tokens. No credit card required. Scale when ready.' },
]

export default function App() {
  const path = window.location.pathname.replace(/\.html$/, '')
  if (path === '/models' || path === '/#/models') {
    return <ModelsPage />
  }

  const heroRef = useRef<HTMLDivElement>(null!)
  const showcaseRef = useRef<HTMLDivElement>(null!)
  const featuresRef = useRef<HTMLDivElement>(null!)

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from('.hero-badge', { y: 30, opacity: 0, duration: 0.5, stagger: 0.08 })
      .from('.hero-title-line', { y: 60, opacity: 0, duration: 0.6, stagger: 0.1 }, '-=0.3')
      .from('.hero-desc', { y: 30, opacity: 0, duration: 0.5 }, '-=0.4')
      .from('.hero-cta', { y: 30, opacity: 0, duration: 0.4, stagger: 0.1 }, '-=0.3')
      .from('.hero-annotation', { scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(2)' }, '-=0.2')
  }, { scope: heroRef })

  useGSAP(() => {
    gsap.from('.showcase-card', {
      y: 50,
      opacity: 0,
      duration: 0.6,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: showcaseRef.current, start: 'top 80%' },
    })
  }, { scope: showcaseRef })

  useGSAP(() => {
    gsap.from('.feature-card', {
      y: 40,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' },
    })
  }, { scope: featuresRef })

  return (
    <div className="relative min-h-screen bg-nb-cream text-nb-black font-body overflow-x-hidden">
      {/* Grain texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025] z-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* ===== Navbar ===== */}
      <nav className="relative z-40 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <a href="/" className="flex items-center gap-2 group">
          <div className="flex h-10 w-10 items-center justify-center bg-nb-yellow border-[3px] border-nb-black shadow-nb-sm group-hover:shadow-nb transition-all duration-100">
            <FontAwesomeIcon icon={faBolt} className="text-nb-black text-lg" />
          </div>
          <span className="font-display text-xl">optimized<span className="text-nb-muted">LLM</span></span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          <a href="/models" className="text-sm font-semibold hover:underline underline-offset-4 underline decoration-nb-yellow decoration-2">Models</a>
          <a href="/docs.html" className="text-sm font-semibold hover:underline underline-offset-4 underline decoration-nb-pink decoration-2">Docs</a>
          <a href="/pricing.html" className="text-sm font-semibold hover:underline underline-offset-4 underline decoration-nb-lime decoration-2">Pricing</a>
          <Button variant="dark" size="sm" asChild>
            <a href="/login.html">Sign In <FontAwesomeIcon icon={faArrowRight} className="text-xs" /></a>
          </Button>
        </div>

        <button className="md:hidden flex items-center gap-2 border-[3px] border-nb-black bg-nb-black text-nb-white px-4 py-2 text-sm font-bold shadow-nb-sm">
          <FontAwesomeIcon icon={faBars} />
          Menu
        </button>
      </nav>

      {/* ===== Hero ===== */}
      <section ref={heroRef} className="relative overflow-hidden">
        <ThreeBackground />
        <div className="absolute inset-0 nb-grid-bg pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-6 pt-8 pb-20 md:px-10 md:pt-16 md:pb-28">
          {/* Badges */}
          <div className="hero-badge flex flex-wrap items-center gap-3">
            <Badge variant="lime" size="lg">
              <span className="h-2 w-2 rounded-full bg-nb-black" />
              100+ models live
            </Badge>
            <Badge variant="secondary" size="lg">OpenAI-compatible</Badge>
            <Badge variant="pink" size="lg">Free tier</Badge>
          </div>

          {/* Heading */}
          <div className="relative">
            <h1 className="mt-8 font-display text-6xl leading-[0.9] tracking-tight sm:text-7xl md:text-8xl lg:text-[9rem]">
              <div className="hero-title-line">Ship</div>
              <div className="hero-title-line">
                <span className="relative inline-block mr-3 md:mr-4">
                  <span className="relative z-10">smarter</span>
                  <span className="absolute inset-x-0 bottom-1 md:bottom-3 -z-0 h-5 md:h-10 bg-nb-yellow" />
                </span>
                <span>with one</span>
              </div>
              <div className="hero-title-line">
                <span className="bg-nb-black text-nb-white px-3 md:px-5 py-1 md:py-2 mr-3">API</span>
                <span>.</span>
              </div>
            </h1>

            {/* Annotation */}
            <div className="hero-annotation hidden lg:flex absolute -right-8 top-16 rotate-6 items-center gap-1 bg-nb-white border-[3px] border-nb-black px-3 py-2 shadow-nb-sm">
              <span className="font-body text-xs font-bold">yes, one API</span>
              <span className="text-lg">↗</span>
            </div>
          </div>

          {/* Description */}
          <p className="hero-desc mt-8 max-w-2xl text-lg text-nb-muted md:text-xl">
            One unified gateway for 100+ NVIDIA NIM models.
            <span className="font-semibold text-nb-black"> OpenAI-compatible, streaming-native,</span> and built for production.
          </p>

          {/* CTAs */}
          <div className="hero-cta mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Button variant="default" size="lg" asChild>
              <a href="/register.html">
                Get Free API Key <FontAwesomeIcon icon={faArrowRight} />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="/docs.html">Read the Docs</a>
            </Button>
            <a href="/models" className="text-sm font-semibold underline underline-offset-4 hover:text-nb-blue ml-1">
              or browse 100+ models
            </a>
          </div>
        </div>
      </section>

      {/* ===== Marquee ===== */}
      <Marquee />

      {/* ===== Model Showcase ===== */}
      <section ref={showcaseRef} className="mx-auto max-w-7xl px-6 md:px-10 pt-20 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <Badge variant="dark" size="lg" className="mb-4">Available now</Badge>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.95]">
              Pick your<br />
              <span className="bg-nb-pink px-2">model.</span>
            </h2>
          </div>
          <Button variant="dark" size="sm" asChild className="hidden md:inline-flex">
            <a href="/models">View all <FontAwesomeIcon icon={faArrowRight} className="text-xs" /></a>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {MODELS.map((model, idx) => (
            <Card key={model.id} className={`${model.bg} showcase-card ${idx % 2 === 0 ? 'rotate-[-0.3deg]' : 'rotate-[0.3deg]'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className={`h-3 w-3 rounded-full border-2 border-nb-black ${model.bg.replace('/30', '')}`} />
                  <Badge variant="dark" size="sm">{model.badge}</Badge>
                </div>
                <CardTitle className="font-mono text-sm font-bold mt-2">{model.id}</CardTitle>
                <CardDescription>{model.desc}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="dark" size="sm" className="w-full">
                  Try model <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-8 bg-nb-yellow border-[3px] border-nb-black px-6 py-4 flex items-center justify-between shadow-nb-sm">
          <span className="font-display text-xs tracking-wide flex items-center gap-2">
            <FontAwesomeIcon icon={faBolt} />
            4 models live · more coming
          </span>
          <Badge variant="dark" size="sm">OpenAI-compatible</Badge>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section ref={featuresRef} className="border-y-[3px] border-nb-black bg-nb-gray/30">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-20">
          <div className="mb-14">
            <div className="flex gap-3 mb-4">
              <Badge variant="dark" size="lg">Why us</Badge>
              <div className="w-8 h-8 bg-nb-lime border-[3px] border-nb-black shadow-nb-sm rotate-6" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.95] max-w-2xl">
              Everything you need<br />
              <span className="bg-nb-yellow px-2">to ship LLM apps.</span>
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, idx) => (
              <div
                key={f.title}
                className={`feature-card bg-nb-white border-[3px] border-nb-black p-6 shadow-nb hover:shadow-nb-lg transition-all duration-100 hover:-translate-y-1 ${
                  idx === 0 ? '-rotate-1' : idx === 1 ? 'rotate-1' : idx === 2 ? '-rotate-[0.5deg]' : 'rotate-[0.5deg]'
                }`}
              >
                <div className="w-10 h-10 flex items-center justify-center bg-nb-yellow border-[3px] border-nb-black shadow-nb-sm mb-4">
                  <FontAwesomeIcon icon={f.icon} className="text-nb-black text-lg" />
                </div>
                <h3 className="font-display text-2xl leading-[1.1] mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed text-nb-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA Strip ===== */}
      <section className="bg-nb-black text-nb-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight">
              Start shipping <span className="text-nb-yellow">smarter</span>.
            </h2>
            <p className="mt-2 text-sm text-nb-white/50 max-w-md">
              One API key unlocks 100+ models. No credit card required.
            </p>
          </div>
          <div className="flex gap-4">
            <Button variant="default" size="lg" asChild>
              <a href="/register.html">
                Get Free Key <FontAwesomeIcon icon={faArrowRight} />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="!bg-transparent !text-nb-white !border-nb-white" asChild>
              <a href="/docs.html">Docs</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t-[3px] border-nb-black bg-nb-white">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center bg-nb-yellow border-[3px] border-nb-black">
                  <FontAwesomeIcon icon={faBolt} className="text-nb-black text-sm" />
                </div>
                <span className="font-display text-lg">optimized<span className="text-nb-muted">LLM</span></span>
              </div>
              <p className="max-w-sm text-sm text-nb-muted">
                The OpenAI-compatible API gateway for NVIDIA NIM models. Ship faster, pay less.
              </p>
              <div className="flex gap-3 mt-4">
                {[faStar, faCheck, faLock].map((icon, i) => (
                  <div key={i} className="w-9 h-9 flex items-center justify-center bg-nb-gray border-[2px] border-nb-black">
                    <FontAwesomeIcon icon={icon} className="text-nb-black text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-display text-xs uppercase tracking-wider text-nb-muted mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Models</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Pricing</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Docs</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-xs uppercase tracking-wider text-nb-muted mb-4">Account</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Sign In</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Sign Up</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Status</a></li>
                <li><a href="#" className="font-semibold hover:text-nb-yellow transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t-[3px] border-nb-black pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-nb-muted">
              &copy; {new Date().getFullYear()} optimizedLLM. All rights reserved.
            </p>
            <div className="flex gap-6 text-xs text-nb-muted">
              <span className="hover:underline cursor-pointer">Terms</span>
              <span className="hover:underline cursor-pointer">Privacy</span>
              <span className="hover:underline cursor-pointer">Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
