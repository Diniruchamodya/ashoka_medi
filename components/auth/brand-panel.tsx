import Image from 'next/image'

export function BrandPanel() {
  return (
    <section
      aria-label="About Ashoka Medi-Lab"
      className="flex flex-col items-center justify-center gap-8 bg-brand px-6 py-10 text-center md:flex-1 md:flex-row md:gap-10 md:px-12 md:text-left"
    >
      <Image
        src="/images/ashoka-logo.jpg"
        alt="Ashoka Medi-Lab logo"
        width={260}
        height={260}
        priority
        className="size-40 rounded-2xl shadow-lg ring-4 ring-white/30 md:size-56"
      />
      <div className="flex max-w-sm flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.2em] text-brand-deep uppercase">
          Ashoka Medi-Lab
        </p>
        <p className="text-pretty text-xl leading-relaxed font-medium text-[oklch(0.2_0.05_230)] md:text-2xl">
          With over 35 years of experience, we deliver fast, accurate, and affordable laboratory
          services to support your health and well-being.
        </p>
      </div>
    </section>
  )
}
