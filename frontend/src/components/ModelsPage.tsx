import { useState, useEffect, useRef, useMemo } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faCopy, faCircleNotch, faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/button'

interface Pricing { prompt?: string; completion?: string }
interface Architecture { modality?: string; input_modalities?: string[]; output_modalities?: string[] }
interface Model {
  id: string; description?: string; owned_by?: string
  context_length?: number | null; pricing?: Pricing | null
  architecture?: Architecture | null; or_name?: string | null; supported_parameters?: string[] | null
}

function fmtContext(len: number | null | undefined): string {
  if (!len) return ''
  if (len >= 1_000_000) return `${(len / 1_000_000).toFixed(1)}M`.replace('.0', '')
  if (len >= 1_000) return `${(len / 1_000).toFixed(0)}K`
  return `${len}`
}

function fmtPrice(price: string | undefined | null): string {
  if (!price) return ''
  const num = parseFloat(price)
  if (isNaN(num)) return ''
  const per1k = num * 1000
  if (per1k === 0) return 'free'
  if (per1k < 0.0001) return `$${per1k.toFixed(6)}`
  if (per1k < 0.01) return `$${per1k.toFixed(5)}`
  return `$${per1k.toFixed(4)}`
}

const PROVIDER_COLORS: Record<string, string> = {
  nvidia: '#C5E063', meta: '#4A90E2', mistralai: '#FF8C42',
  microsoft: '#4A90E2', google: '#B8A1FF', deepseek: '#FFD23F',
  qwen: '#FF6B9D', '01-ai': '#FFD23F', ai21labs: '#FF8C42',
  databricks: '#FF6B9D', upstage: '#4A90E2', zyphra: '#B8A1FF',
}

const PROVIDERS = ['all', 'nvidia', 'meta', 'deepseek', 'mistralai', 'google', 'microsoft', 'qwen']

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([])
  const [filtered, setFiltered] = useState<Model[]>([])
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null!)
  const gridRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    async function load() {
      try {
        setError(false); setLoading(true)
        const res = await fetch('/api/models')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setModels(data.data || [])
        setFiltered(data.data || [])
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    const q = query.toLowerCase().trim()
    let result = models
    if (q) result = result.filter(m => m.id.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q))
    if (provider !== 'all') result = result.filter(m => m.id.startsWith(provider + '/'))
    setFiltered(result)
  }, [query, provider, models])

  useGSAP(() => {
    gsap.from('.hero-el', { y: 30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
    gsap.from('.filter-el', { y: 20, opacity: 0, duration: 0.4, delay: 0.25, ease: 'power3.out', stagger: 0.04 })
  }, { scope: pageRef })

  useGSAP(() => {
    if (!loading && filtered.length > 0) {
      gsap.fromTo('.model-card',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.025, ease: 'power2.out', clearProps: 'opacity' }
      )
    }
  }, { dependencies: [loading, filtered], scope: gridRef })

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {
      setCopiedId('__error__'); setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function providerBase(id: string) { return id.split('/')[0] }

  function providerColor(id: string): string {
    return PROVIDER_COLORS[providerBase(id)] || '#E8E4DC'
  }

  const enrichedCount = useMemo(() => filtered.filter(m => m.or_name).length, [filtered])

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF7F0] text-[#0A0A0A] font-['Inter',system-ui,sans-serif]">
      {/* Navbar */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-[#FFD23F] border-2 border-[#0A0A0A]">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#0A0A0A]"><path d="M7.5 1L6 6H2l3.5 3L4 15l5-5.5L11 9l-1.5-3L12 3.5 10 1H7.5z"/></svg>
          </div>
          <span className="font-['Archivo_Black',system-ui,sans-serif] text-base tracking-tight">optimized<span className="text-[#6B6B6B]">LLM</span></span>
        </a>
        <div className="flex items-center gap-5 text-xs font-semibold">
          <a href="/models" className="underline underline-offset-4 decoration-[#FFD23F] decoration-2">Models</a>
          <a href="/docs.html" className="hover:underline underline-offset-4">Docs</a>
          <a href="/pricing.html" className="hover:underline underline-offset-4">Pricing</a>
          <a href="/login.html" className="border-2 border-[#0A0A0A] bg-[#0A0A0A] text-white px-3 py-1.5 text-[11px] font-bold">Sign In</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-6">
        <div className="hero-el">
          <h1 className="font-['Archivo_Black',system-ui,sans-serif] text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[0.9]">
            Models
          </h1>
          <p className="mt-3 text-sm text-[#6B6B6B] max-w-lg leading-relaxed">
            {filtered.length} NVIDIA NIM models, one OpenAI-compatible API.
            {enrichedCount > 0 && <> <span className="text-[#0A0A0A]">{enrichedCount}</span> with pricing &amp; context data.</>}
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative mb-4">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-xs" />
          <input
            type="text"
            placeholder="Search models..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full border-2 border-[#0A0A0A] bg-white pl-9 pr-3 py-2.5 text-xs outline-none transition-shadow focus:shadow-[3px_3px_0_#0A0A0A]"
          />
        </div>

        <div className="filter-el flex flex-wrap items-center gap-1.5 pb-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {PROVIDERS.map(p => {
            const active = provider === p
            return (
              <button key={p} onClick={() => setProvider(p)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-2 border-[#0A0A0A] transition-all ${
                  active ? 'bg-[#0A0A0A] text-white shadow-[2px_2px_0_#0A0A0A]' : 'bg-white text-[#0A0A0A] hover:bg-[#E8E4DC]'
                }`}>
                {p === 'all' ? 'All' : p}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <FontAwesomeIcon icon={faCircleNotch} className="text-lg text-[#0A0A0A] animate-spin" />
            <p className="text-xs font-semibold text-[#6B6B6B]">Loading catalog</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-xs font-bold text-[#FF6B9D]">Failed to load models</p>
            <Button variant="default" size="sm" onClick={() => window.location.reload()}>
              Retry <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-xs font-semibold text-[#6B6B6B]">No models match your search</p>
            <button onClick={() => { setQuery(''); setProvider('all') }}
              className="text-[10px] font-bold underline underline-offset-4 mt-1">Clear filters</button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div ref={gridRef} className="grid gap-3 pb-20 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m, i) => {
              const isCopied = copiedId === m.id
              const base = providerBase(m.id)
              const ctx = fmtContext(m.context_length)
              const hasCtx = m.context_length != null
              const promptPrice = fmtPrice(m.pricing?.prompt)
              const completionPrice = fmtPrice(m.pricing?.completion)
              return (
                <div key={m.id} className="model-card relative bg-white border-2 border-[#0A0A0A] hover:shadow-[4px_4px_0_#0A0A0A] transition-all duration-100 hover:-translate-y-0.5 flex flex-col"
                  style={{ borderLeftWidth: '4px', borderLeftColor: providerColor(m.id) }}>
                  <div className="px-4 pt-4 pb-3 flex flex-col gap-2 flex-1">
                    {/* Provider row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full border border-[#0A0A0A] shrink-0" style={{ backgroundColor: providerColor(m.id) }} />
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B6B6B] truncate">{base}</span>
                      </div>
                      {hasCtx && (
                        <span className="text-[9px] font-mono font-bold text-[#6B6B6B] border border-[#0A0A0A]/20 px-1.5 py-0.5 tabular-nums leading-none shrink-0">
                          {ctx}
                        </span>
                      )}
                    </div>

                    {/* Model name */}
                    <h3 className="font-['Archivo_Black',system-ui,sans-serif] text-sm leading-tight break-all">
                      {m.id}
                    </h3>

                    {/* Pricing */}
                    {(promptPrice || completionPrice) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {promptPrice && (
                          <span className="text-[9px] font-mono font-bold text-[#0A0A0A] bg-[#FFD23F]/30 border border-[#0A0A0A]/20 px-1.5 py-0.5 leading-none">
                            in {promptPrice}
                          </span>
                        )}
                        {completionPrice && (
                          <span className="text-[9px] font-mono font-bold text-[#0A0A0A] bg-[#FF6B9D]/20 border border-[#0A0A0A]/20 px-1.5 py-0.5 leading-none">
                            out {completionPrice}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Live badge */}
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-[#6B6B6B] mt-auto">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C5E063] border border-[#0A0A0A]" />
                      Live
                    </span>
                  </div>

                  {/* Copy button */}
                  <button onClick={() => copyId(m.id)}
                    className={`w-full border-t-2 border-[#0A0A0A] text-[10px] font-bold py-2 flex items-center justify-center gap-1.5 transition-all active:translate-y-[1px] ${
                      isCopied ? 'bg-[#C5E063] text-[#0A0A0A]' : 'bg-[#FAF7F0] text-[#0A0A0A] hover:bg-[#E8E4DC]'
                    }`}>
                    {isCopied ? <><FontAwesomeIcon icon={faCheck} className="text-[9px]" /> Copied</> : <><FontAwesomeIcon icon={faCopy} className="text-[9px]" /> Copy ID</>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {copiedId && copiedId !== '__error__' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0A0A0A] text-white border-2 border-[#0A0A0A] px-4 py-2.5 shadow-[4px_4px_0_#0A0A0A] text-[11px] font-semibold"
          style={{ animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
          <FontAwesomeIcon icon={faCheck} className="text-[#C5E063] text-[10px]" />
          Copied {copiedId}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  )
}
