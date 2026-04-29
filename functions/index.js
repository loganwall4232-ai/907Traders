const { onRequest }  = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { parse } = require('node-html-parser')

initializeApp()
const db = getFirestore()

/* ─────────────────────────────────────────────────────────
   1. TRADINGVIEW WEBHOOK
   TradingView alert → POST to this endpoint
   Body (JSON):
   {
     "symbol":      "NQ1!",
     "direction":   "LONG",         // or "SHORT"
     "confluences": ["Liq Sweep", "BOS", "FVG"],
     "message":     "optional extra text",
     "secret":      "YOUR_SECRET_KEY"    // set below
   }
   ───────────────────────────────────────────────────────── */
const WEBHOOK_SECRET = process.env.TV_SECRET || 'change_this_secret'

exports.tradingviewWebhook = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    // Validate secret
    if (body.secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { symbol, direction, confluences, message } = body

    await db.collection('alerts').add({
      type:        'tv_alert',
      symbol:      symbol  || '',
      direction:   direction || '',
      confluences: Array.isArray(confluences) ? confluences : [],
      message:     message || '',
      timestamp:   FieldValue.serverTimestamp(),
    })

    return res.status(200).json({ ok: true })
  }
)

/* ─────────────────────────────────────────────────────────
   2. FOREXFACTORY NEWS SCRAPER
   Runs every 5 minutes — scrapes FF news → stores new articles
   in Firestore 'newsItems' collection (deduped by URL).
   ───────────────────────────────────────────────────────── */
exports.scrapeForexFactoryNews = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    const FF_NEWS_URL = 'https://www.forexfactory.com/news'
    let html
    try {
      const resp = await fetch(FF_NEWS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; 907Traders-bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      html = await resp.text()
    } catch (err) {
      console.error('FF fetch error:', err)
      return
    }

    const root = parse(html)
    const articles = []

    // FF news items are in .flexposts__story elements
    const stories = root.querySelectorAll('.flexposts__story, .news-item, article')
    for (const el of stories.slice(0, 20)) {
      const titleEl   = el.querySelector('.flexposts__story-title, .title, h3, h2')
      const linkEl    = el.querySelector('a')
      const bodyEl    = el.querySelector('.flexposts__story-excerpt, .excerpt, p')
      const timeEl    = el.querySelector('time, .date, .time')

      const title   = titleEl?.text?.trim()
      const url     = linkEl?.getAttribute('href')
      const content = bodyEl?.text?.trim()
      const rawTime = timeEl?.getAttribute('datetime') || timeEl?.text?.trim()

      if (!title || !url) continue

      const fullUrl = url.startsWith('http') ? url : `https://www.forexfactory.com${url}`
      articles.push({ title, url: fullUrl, content: content || '', rawTime })
    }

    // Dedup + write
    for (const article of articles) {
      const existing = await db.collection('newsItems')
        .where('url', '==', article.url)
        .limit(1)
        .get()

      if (!existing.empty) continue

      let publishedAt = FieldValue.serverTimestamp()
      if (article.rawTime) {
        const d = new Date(article.rawTime)
        if (!isNaN(d.getTime())) publishedAt = d
      }

      await db.collection('newsItems').add({
        type:        'ff_news',
        title:       article.title,
        content:     article.content,
        url:         article.url,
        publishedAt,
        scrapedAt:   FieldValue.serverTimestamp(),
      })
    }

    console.log(`Scraped ${articles.length} articles, wrote new ones.`)
  }
)
