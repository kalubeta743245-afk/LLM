import { useRef, useEffect } from 'react'
import gsap from 'gsap'

const models = [
  { id: 'moonshotai/kimi-k2.6', dot: 'bg-nb-lime' },
  { id: 'minimax/minimax-01', dot: 'bg-nb-pink' },
  { id: 'zhipu/glm-4', dot: 'bg-nb-blue' },
  { id: 'deepseek-ai/deepseek-chat', dot: 'bg-nb-yellow' },
]

export default function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const track = trackRef.current
    const items = track.children
    if (!items.length) return

    const totalWidth = (items[0] as HTMLElement).offsetWidth * items.length
    gsap.to(track, {
      x: -totalWidth / 2,
      duration: 30,
      ease: 'none',
      repeat: -1,
    })
  }, [])

  return (
    <div className="border-y-[3px] border-nb-black bg-nb-white overflow-hidden">
      <div className="relative flex overflow-hidden py-3">
        <div ref={trackRef} className="flex gap-12 whitespace-nowrap px-6">
          {[...Array(2)].flatMap((_, i) =>
            models.map((m) => (
              <span
                key={m.id + i}
                className="font-mono text-sm font-bold tracking-tight flex items-center gap-2"
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                {m.id}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
