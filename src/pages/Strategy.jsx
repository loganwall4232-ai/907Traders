import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroCanvas from '../components/visual/HeroCanvas'
import { useTheme } from '../context/ThemeContext'

gsap.registerPlugin(ScrollTrigger)

/* ─────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────── */
const PIPELINE = [
  { label: 'Learn the System',              num: '01' },
  { label: 'Journal Every Trade',           num: '02' },
  { label: 'Let Your Data Refine You',      num: '03' },
  { label: 'Lock In Your Personal Ruleset', num: '04' },
  { label: 'This App Holds You to It',      num: '05' },
]

const CONFLUENCES = {
  reversal: {
    label: 'Reversal',
    sub: 'The trigger — direction is changing.',
    color: 'var(--reversal)',
    bg: 'rgba(255,112,67,0.07)',
    border: 'rgba(255,112,67,0.22)',
    glow: 'rgba(255,112,67,0.15)',
    items: [
      { name: 'Liquidity Sweep', desc: 'Price breaks a previous high or low, grabbing liquidity before reversing.' },
    ],
  },
  confirmation: {
    label: 'Confirmation',
    sub: 'Proof the reversal is real.',
    color: 'var(--confirmation)',
    bg: 'rgba(77,208,225,0.07)',
    border: 'rgba(77,208,225,0.22)',
    glow: 'rgba(77,208,225,0.15)',
    items: [
      { name: 'BOS',  desc: 'Break of Structure — price breaks the previous high/low, confirming the structural shift.' },
      { name: 'IFVG', desc: 'Inverse Fair Value Gap — an FVG price has closed through, flipped into a draw in the opposite direction.' },
      { name: 'SMT',  desc: 'SMT Divergence — ES and NQ make conflicting moves. The confirming index leads. Use it to pick your instrument.' },
    ],
  },
  continuation: {
    label: 'Continuation',
    sub: 'Momentum in the confirmed direction.',
    color: 'var(--continuation)',
    bg: 'rgba(105,240,174,0.07)',
    border: 'rgba(105,240,174,0.22)',
    glow: 'rgba(105,240,174,0.15)',
    items: [
      { name: 'FVG', desc: 'Fair Value Gap — imbalance from 3 consecutive same-direction candles. Price draws back to close it.' },
      { name: 'EQ',  desc: 'Equilibrium — GANN box 0.5 level. Below = discount (expect rise). Above = premium (expect fall).' },
      { name: 'OB',  desc: 'Order Block — the last opposing candle before a strong institutional move.' },
      { name: 'BB',  desc: 'Breaker Block — a failed OB that price broke through, now flipped support/resistance.' },
    ],
  },
}

const DRILL = [
  'Mark previous session H/L, previous day H/L, weekly H/L, and all major structural levels.',
  'Wait for a Reversal confluence at or near market open.',
  'Drop to 5-minute — wait for a Confirmation confluence.',
  'Wait for a 5-minute Continuation confluence.',
  'Scale to 1-minute — wait for a 1-minute Confirmation.',
  'Enter. SL at structural invalidation. TP at nearest significant previous session/day/week high or low.',
]

const PSYCH = [
  {
    num: '01',
    title: 'Emotional Regulation',
    body: "You will have green days that feel electric. You will have red days that feel personal. Neither of those feelings is data. A day where you took 5 trades and made money is not a good day — it's a lucky day that built bad habits. A day where you took 2 clean setups and both stopped out is not a bad day — that's the strategy working exactly as designed.",
  },
  {
    num: '02',
    title: 'Discipline Over Impulse',
    body: "Do not move your stop loss. Do not take a 3rd trade because you're on a roll. Do not skip the macro window. Every rule in this system was built because breaking it has a predictable cost. The rules have proven themselves. Your in-the-moment feelings have not.",
  },
  {
    num: '03',
    title: 'Environment & Routine',
    body: 'Market open in Alaska is 5:30 AM. You are awake, desk clean, charts set, levels marked before 5:30. This is a job. It has a start time. When the macro window opens at 9:50 ET, you are already locked in. A clean physical space produces a clean mental state.',
  },
  {
    num: '04',
    title: 'The Long Game',
    body: "This app does not lie, does not get tired, does not have emotions. It shows you exactly what your data says. Build your personalized ruleset from your own data. Protect that ruleset like it is your edge — because it is. Let this app be the accountability partner that catches you before a bad habit becomes a losing streak.",
  },
]

/* ─────────────────────────────────────────────────────
   TICKER
───────────────────────────────────────────────────── */
const TICKERS = [
  { pair: 'ES', val: '5,842.25', delta: '+0.34%', up: true },
  { pair: 'NQ', val: '20,441.75', delta: '+0.58%', up: true },
  { pair: 'MES', val: '5,842.25', delta: '+0.34%', up: true },
  { pair: 'MNQ', val: '20,441.75', delta: '+0.58%', up: true },
  { pair: 'MACRO WINDOW', val: '9:50–10:10 ET', delta: '', special: true },
  { pair: 'MAX TRADES', val: '2 / DAY', delta: '', special: true },
  { pair: 'SESSION', val: 'NY OPEN', delta: '', special: true },
]

function Ticker() {
  const doubled = [...TICKERS, ...TICKERS]
  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {doubled.map((t, i) => (
          <div key={i} className="ticker-item">
            <span style={{ color: t.special ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 700 }}>
              {t.pair}
            </span>
            <span>{t.val}</span>
            {t.delta && (
              <span className={t.up ? 'up' : 'down'}>{t.delta}</span>
            )}
            <span style={{ color: 'var(--card-border)', margin: '0 8px' }}>·</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────── */
export default function Strategy() {
  const { accent } = useTheme()
  const heroRef  = useRef()
  const titleRef = useRef()

  useEffect(() => {
    const ctx = gsap.context(() => {

      /* Hero */
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.hero-tag',    { opacity: 0, y: -16, duration: 0.6 })
        .from('.hero-title',  { opacity: 0, y: 40,  duration: 1.0, stagger: 0.12 }, '-=0.2')
        .from('.hero-sub',    { opacity: 0, y: 20,  duration: 0.7 }, '-=0.5')
        .from('.hero-cta',    { opacity: 0, y: 16,  duration: 0.6 }, '-=0.4')
        .from('.pipe-step',   { opacity: 0, x: -30, duration: 0.5, stagger: 0.1 }, '-=0.3')

      /* Ticker */
      gsap.from('.ticker-wrap', { opacity: 0, duration: 0.8, delay: 1.2 })

      /* Scroll-triggered sections */
      gsap.utils.toArray('.s-reveal').forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 60, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
        })
      })

      /* Confluence card groups */
      gsap.utils.toArray('.conf-group').forEach((group) => {
        gsap.from(group.querySelectorAll('.conf-item'), {
          opacity: 0, y: 32, scale: 0.94, duration: 0.6,
          stagger: 0.1, ease: 'back.out(1.4)',
          scrollTrigger: { trigger: group, start: 'top 82%', toggleActions: 'play none none none' },
        })
      })

      /* Drill steps */
      gsap.from('.drill-row', {
        opacity: 0, x: -24, duration: 0.5, stagger: 0.09,
        scrollTrigger: { trigger: '.drill-list', start: 'top 82%', toggleActions: 'play none none none' },
      })

      /* Band rows */
      gsap.from('.band-row', {
        opacity: 0, scaleX: 0.92, duration: 0.5, stagger: 0.12, transformOrigin: 'left',
        scrollTrigger: { trigger: '.band-wrap', start: 'top 82%', toggleActions: 'play none none none' },
      })

      /* Psych pillars */
      gsap.from('.psych-item', {
        opacity: 0, y: 40, duration: 0.65, stagger: 0.15,
        scrollTrigger: { trigger: '.psych-grid', start: 'top 82%', toggleActions: 'play none none none' },
      })

      /* Counter animation */
      gsap.utils.toArray('.counter').forEach((el) => {
        const target = parseFloat(el.dataset.target)
        gsap.from({ val: 0 }, {
          val: target, duration: 1.8, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
          onUpdate() { el.textContent = Number(this.targets()[0].val).toFixed(el.dataset.dec || 0) },
        })
      })

    }, heroRef)

    return () => {
      ctx.revert()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])

  return (
    <div className="strategy-page page-fade-in" ref={heroRef}>

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="s-hero">
        <HeroCanvas accent={accent} />

        <div className="s-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-tag section-badge">907TRADERS · THE SYSTEM</div>

          <h1 className="hero-title display-heading" style={{ fontSize: 'clamp(4rem,11vw,9rem)', color: '#fff' }}>
            TRADE<br />
            <span className="text-gradient">THE EDGE.</span><br />
            NOT THE<br />EMOTION.
          </h1>

          <p className="hero-sub" style={{ maxWidth: 520, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: '24px 0 36px' }}>
            907Traders is a system. Not a vibe, not a signal group, not a place to guess. You're going to learn a repeatable edge, prove it works through your own data, and then follow it without compromise.
          </p>

          <div className="hero-cta flex gap-12">
            <a href="#strategy" className="btn btn-primary btn-lg">The Strategy</a>
            <a href="#risk"     className="btn btn-neon btn-lg">Risk Rules</a>
          </div>
        </div>

        {/* Pipeline ribbon */}
        <div className="pipeline-ribbon">
          <div className="s-container">
            <div className="pipeline-row">
              {PIPELINE.map((step, i) => (
                <div key={step.num} className="pipe-step">
                  <div className="pipe-num mono">{step.num}</div>
                  <div className="pipe-label">{step.label}</div>
                  {i < PIPELINE.length - 1 && (
                    <div className="pipe-arrow accent">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────── */}
      <Ticker />

      {/* ── SECTION 1: STRATEGY ──────────────────────── */}
      <section className="s-section s-reveal" id="strategy">
        <div className="s-container">
          <div className="section-badge">01 — THE STRATEGY</div>
          <div className="accent-line" />
          <h2 className="display-heading s-reveal" style={{ fontSize: 'clamp(2.4rem,5vw,4rem)', marginBottom: 8 }}>
            THE SETUP
          </h2>
          <p className="s-reveal" style={{ color: 'var(--text-secondary)', maxWidth: 540, marginBottom: 40 }}>
            New York session only. Macro window only. Maximum 2 trades per day.
            Every setup runs through the same drill.
          </p>

          {/* Meta cards */}
          <div className="meta-row s-reveal">
            {[
              { label: 'Instruments', value: 'ES · NQ · MES · MNQ', mono: true, accent: true },
              { label: 'Session',     value: 'New York 9:30 AM ET', sub: '5:30 AM Alaska' },
              { label: 'Macro Window',value: '9:50 – 10:10 AM ET', mono: true, accent: true, warn: 'Entries inside this window only' },
              { label: 'Trade Limit', value: 'Max 2 / Day',         sub: '3rd only if both 1 & 2 are green' },
            ].map((m) => (
              <div key={m.label} className="meta-card card-premium card-glow tilt">
                <div className="meta-label muted">{m.label}</div>
                <div className={`meta-val ${m.mono ? 'mono' : ''} ${m.accent ? 'accent' : ''}`}>
                  {m.value}
                </div>
                {m.sub  && <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{m.sub}</div>}
                {m.warn && <div style={{ fontSize: '0.72rem', color: 'var(--loss)', marginTop: 6 }}>{m.warn}</div>}
              </div>
            ))}
          </div>

          {/* Confluence types */}
          <h3 className="s-reveal" style={{ marginTop: 52, marginBottom: 28, fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.04em' }}>
            THE THREE CONFLUENCE TYPES
          </h3>

          <div className="conf-types">
            {Object.entries(CONFLUENCES).map(([key, type]) => (
              <div key={key} className="conf-group s-reveal">
                <div className="conf-type-header" style={{ borderColor: type.border }}>
                  <span className="conf-type-label mono" style={{ color: type.color }}>{type.label}</span>
                  <span className="muted" style={{ fontSize: '0.83rem' }}>{type.sub}</span>
                </div>
                <div className="conf-items">
                  {type.items.map((item) => (
                    <div
                      key={item.name}
                      className="conf-item card-glow tilt"
                      style={{ background: type.bg, border: `1px solid ${type.border}`, borderRadius: 'var(--radius)', padding: '18px 20px', boxShadow: `0 4px 20px ${type.glow}` }}
                    >
                      <div className="conf-name" style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '0.9rem', color: type.color, marginBottom: 8 }}>
                        {item.name}
                      </div>
                      <p style={{ fontSize: '0.84rem', lineHeight: 1.65 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Entry Drill */}
          <div className="drill-block s-reveal card-premium" style={{ marginTop: 48 }}>
            <div className="section-badge" style={{ marginBottom: 20 }}>Entry Drill — Run Every Setup Through This</div>
            <div className="drill-list">
              {DRILL.map((step, i) => (
                <div key={i} className="drill-row">
                  <div className="drill-num mono text-glow">{String(i + 1).padStart(2, '0')}</div>
                  <div className="drill-bar" />
                  <div className="drill-text">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="hr-glow" style={{ margin: 0 }} />

      {/* ── SECTION 2: RISK MANAGEMENT ───────────────── */}
      <section className="s-section" id="risk">
        <div className="s-container">
          <div className="section-badge s-reveal">02 — RISK MANAGEMENT</div>
          <div className="accent-line" />
          <h2 className="display-heading s-reveal" style={{ fontSize: 'clamp(2.4rem,5vw,4rem)', marginBottom: 8 }}>
            STAY IN THE BANDS
          </h2>
          <p className="s-reveal" style={{ color: 'var(--text-secondary)', maxWidth: 540, marginBottom: 40 }}>
            You must be inside one of these two profitability bands to be net profitable. Outside both means something in your execution is broken.
          </p>

          {/* Bands */}
          <div className="band-wrap s-reveal">
            <div className="band-header">
              <span>Band</span><span>Win Rate</span><span>R:R Target</span><span>Risk / Trade</span>
            </div>
            <div className="band-row band-standard">
              <div className="flex items-center gap-12">
                <span className="band-dot" style={{ background: 'var(--profit)' }} />
                <span style={{ fontWeight: 700 }}>Standard</span>
              </div>
              <span className="mono profit">≥ 60%</span>
              <span className="mono">1:1 – 1:3</span>
              <span className="mono">1% – 3%</span>
            </div>
            <div className="band-row band-high">
              <div className="flex items-center gap-12">
                <span className="band-dot" style={{ background: 'var(--accent)' }} />
                <span style={{ fontWeight: 700 }}>High R:R</span>
              </div>
              <span className="mono accent">≥ 30%</span>
              <span className="mono">1:3 – 1:10</span>
              <span className="mono">0.5% – 1%</span>
            </div>
          </div>

          <div className="risk-grid s-reveal">
            <div className="card-premium card-glow">
              <div className="section-badge" style={{ marginBottom: 16 }}>Prop Firm Hard Rule</div>
              <div className="mono accent" style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 12 }}>
                Max SL = Drawdown ÷ 10
              </div>
              <p style={{ lineHeight: 1.7 }}>
                Gives you exactly 10 consecutive losing trades before hitting drawdown — the structural safety floor. TP is whatever your target R:R dictates from that SL. These rules stay fixed even when the account is near its limit.
              </p>
            </div>
            <div className="card-premium card-glow">
              <div className="section-badge" style={{ marginBottom: 16 }}>Recovery Ruleset</div>
              <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
                When your stats drift outside a band, the My Stats page auto-generates:
              </p>
              <ul className="recovery-list">
                {[
                  'New minimum R:R given your current win rate',
                  'New minimum win rate given your current R:R',
                  'Recommended max daily trades',
                  'Specific confluences flagged with MoM delta',
                ].map((item) => (
                  <li key={item}>
                    <span className="accent" style={{ marginRight: 10 }}>—</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <hr className="hr-glow" style={{ margin: 0 }} />

      {/* ── SECTION 3: FINANCIAL STRATEGY ────────────── */}
      <section className="s-section">
        <div className="s-container">
          <div className="section-badge s-reveal">03 — FINANCIAL STRATEGY</div>
          <div className="accent-line" />
          <h2 className="display-heading s-reveal" style={{ fontSize: 'clamp(2.4rem,5vw,4rem)', marginBottom: 8 }}>
            PROP FIRMS ARE THE MODEL
          </h2>
          <p className="s-reveal" style={{ color: 'var(--text-secondary)', maxWidth: 540, marginBottom: 48 }}>
            We trade with prop firm capital — not personal money. Fund an evaluation, prove your edge, get funded, take payouts. Losing a funded account is a cost of doing business, not failure.
          </p>

          {/* Flow */}
          <div className="prop-flow s-reveal">
            {['Fund Evaluation', 'Hit Profit Target', 'Get Funded', 'Take Payouts', 'Stack & Repeat'].map((step, i) => (
              <div key={step} className="flow-step">
                <div className="flow-num mono accent">{String(i + 1).padStart(2, '0')}</div>
                <div className="card-premium flow-card">
                  <div style={{ fontWeight: 700 }}>{step}</div>
                </div>
                {i < 4 && <div className="flow-arrow muted">↓</div>}
              </div>
            ))}
          </div>

          <div className="mode-grid s-reveal">
            <div className="card-premium card-glow tilt">
              <div className="mono" style={{ color: 'var(--confirmation)', fontWeight: 700, marginBottom: 12, fontSize: '0.88rem', letterSpacing: '0.08em' }}>
                CHALLENGE MODE
              </div>
              <p style={{ lineHeight: 1.7 }}>More aggressive TP/SL targets. Goal is to hit the profit target fast. Each account stores its own challenge rules separate from your live rules.</p>
            </div>
            <div className="card-premium card-glow tilt">
              <div className="mono" style={{ color: 'var(--profit)', fontWeight: 700, marginBottom: 12, fontSize: '0.88rem', letterSpacing: '0.08em' }}>
                FUNDED MODE
              </div>
              <p style={{ lineHeight: 1.7 }}>Standard risk management rules apply. Protect the account. Consistent payouts over hitting big numbers. The SL floor rule is non-negotiable.</p>
            </div>
            <div className="card-premium card-glow tilt" style={{ gridColumn: '1 / -1' }}>
              <div className="mono" style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 12, fontSize: '0.88rem', letterSpacing: '0.08em' }}>
                STACKING
              </div>
              <p style={{ lineHeight: 1.7 }}>Log one trade — select which accounts it applies to — P&L calculated and applied to each account independently based on their size and contract count. One entry. Multiple accounts. All tracked.</p>
            </div>
          </div>
        </div>
      </section>

      <hr className="hr-glow" style={{ margin: 0 }} />

      {/* ── SECTION 4: PSYCHOLOGY ────────────────────── */}
      <section className="s-section">
        <div className="s-container">
          <div className="section-badge s-reveal">04 — PSYCHOLOGY</div>
          <div className="accent-line" />
          <h2 className="display-heading s-reveal" style={{ fontSize: 'clamp(2.4rem,5vw,4rem)', marginBottom: 40 }}>
            THE FOUR PILLARS
          </h2>
          <div className="psych-grid">
            {PSYCH.map((p) => (
              <div key={p.num} className="psych-item card-premium card-glow">
                <div className="psych-num mono" style={{ fontSize: '3.5rem', fontWeight: 700, color: 'var(--accent)', opacity: 0.18, lineHeight: 1, marginBottom: 16 }}>
                  {p.num}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '0.04em', marginBottom: 14 }}>
                  {p.title.toUpperCase()}
                </h3>
                <p style={{ lineHeight: 1.75, fontSize: '0.93rem' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────── */}
      <section className="s-cta">
        <div className="s-container text-center">
          <div className="section-badge s-reveal" style={{ display: 'inline-flex' }}>Ready?</div>
          <h2 className="display-heading s-reveal text-gradient" style={{ fontSize: 'clamp(3rem,8vw,6rem)', margin: '16px 0 24px' }}>
            START LOGGING.
          </h2>
          <p className="s-reveal" style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.7 }}>
            Every trade you log builds the picture. The picture tells you exactly who you are as a trader. Then you trade that — and nothing else.
          </p>
          <div className="s-reveal flex" style={{ justifyContent: 'center', gap: 14 }}>
            <a href="#/log" className="btn btn-primary btn-lg glow-ring">Log a Trade</a>
            <a href="#/stats" className="btn btn-neon btn-lg">My Stats</a>
          </div>
        </div>
      </section>

      <div style={{ height: 60 }} />

      {/* ── STYLES ───────────────────────────────────── */}
      <style>{`
        .strategy-page { background: var(--bg); min-height: 100%; }

        /* Container */
        .s-container { max-width: 940px; margin: 0 auto; padding: 0 24px; }

        /* ── Hero ── */
        .s-hero {
          position: relative;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 80px 0 0;
          overflow: hidden;
        }
        .s-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 20% 50%, rgba(0,229,255,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 20%, rgba(0,229,255,0.03) 0%, transparent 60%);
          pointer-events: none;
        }

        .hero-title { line-height: 0.92; letter-spacing: -0.01em; }

        /* Pipeline */
        .pipeline-ribbon {
          margin-top: 60px;
          padding: 28px 0;
          background: rgba(0,0,0,0.4);
          border-top: 1px solid var(--card-border);
          backdrop-filter: blur(8px);
        }
        .pipeline-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .pipe-step { display: flex; align-items: center; gap: 8px; }
        .pipe-num { font-size: 0.65rem; font-weight: 700; color: var(--accent); opacity: 0.5; min-width: 20px; }
        .pipe-label {
          padding: 7px 16px;
          border-radius: 8px;
          background: var(--accent-dim);
          border: 1px solid rgba(0,229,255,0.2);
          color: var(--accent);
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .pipe-arrow { color: var(--text-muted); font-size: 1rem; padding: 0 4px; }

        /* ── Sections ── */
        .s-section { padding: 100px 0; }

        /* Meta cards */
        .meta-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 14px;
        }
        .meta-card { padding: 20px; }
        .meta-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .meta-val { font-size: 1rem; font-weight: 700; }

        /* Confluences */
        .conf-types { display: flex; flex-direction: column; gap: 32px; }
        .conf-type-header {
          display: flex; align-items: baseline; gap: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid;
          margin-bottom: 14px;
        }
        .conf-type-label { font-size: 1rem; font-weight: 700; letter-spacing: 0.04em; }
        .conf-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }

        /* Drill */
        .drill-block { padding: 36px; }
        .drill-list { display: flex; flex-direction: column; gap: 20px; }
        .drill-row { display: flex; align-items: center; gap: 18px; }
        .drill-num { font-size: 1.05rem; font-weight: 700; min-width: 32px; flex-shrink: 0; }
        .drill-bar { width: 24px; height: 1px; background: var(--card-border); flex-shrink: 0; }
        .drill-text { line-height: 1.6; color: var(--text-secondary); font-size: 0.93rem; }

        /* Bands */
        .band-wrap { border: 1px solid var(--card-border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 28px; }
        .band-header, .band-row { display: grid; grid-template-columns: 1.4fr 1fr 1.4fr 1fr; gap: 0; align-items: center; }
        .band-header { background: var(--bg-secondary); padding: 12px 20px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .band-row { padding: 18px 20px; border-top: 1px solid var(--card-border); transition: background 0.2s; }
        .band-row:hover { background: rgba(255,255,255,0.02); }
        .band-standard { background: rgba(0,230,118,0.03); }
        .band-high     { background: rgba(0,229,255,0.03); }
        .band-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }

        .risk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .risk-grid { grid-template-columns: 1fr; } }

        .recovery-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .recovery-list li { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; }

        /* Prop flow */
        .prop-flow { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 300px; margin-bottom: 36px; }
        .flow-step { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
        .flow-num { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; padding-left: 4px; }
        .flow-card { padding: 12px 20px; }
        .flow-arrow { font-size: 1.1rem; padding-left: 20px; }

        .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 600px) { .mode-grid { grid-template-columns: 1fr; } }

        /* Psych */
        .psych-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .psych-grid { grid-template-columns: 1fr; } }

        /* CTA */
        .s-cta {
          padding: 100px 0;
          background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,229,255,0.06) 0%, transparent 70%);
        }
      `}</style>
    </div>
  )
}
