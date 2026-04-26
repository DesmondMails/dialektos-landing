;(() => {
  // Очікувана структура таблиці (перший рядок — заголовки):
  //   key,price,currency
  //   pair_a1_b1,375,грн
  //   ...
  //
  const PRICING_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWvB2TiZ5taiS3VqUK0HMg07lTgzELtqhR8_XZ84efrghgZdY10B8x_Pgquum2YQsIOAOXcyO9SLP5/pub?gid=0&single=true&output=csv'

  const STORAGE_KEY = 'dialektos.pricing.v1'

  const MOCK_CSV = `key,price,currency
pair_a1_b1,375,грн
pair_b2,505,грн
individual_a1_b1,585,грн
individual_b2,735,грн
individual_c1,850,грн
booster,388,грн
university,971,грн
school,840,грн
professional,989,грн`

  // ───────────────────────────────────────────────────────────────────────────
  // CSV PARSER (підтримує лапки, екрановані лапки "" та переноси у комірках)
  // ───────────────────────────────────────────────────────────────────────────
  function parseCSV(text) {
    const rows = []
    let row = []
    let cell = ''
    let inQuotes = false

    const pushCell = () => {
      row.push(cell)
      cell = ''
    }
    const pushRow = () => {
      rows.push(row)
      row = []
    }

    const src = text.replace(/\r\n?/g, '\n')
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (inQuotes) {
        if (c === '"' && src[i + 1] === '"') {
          cell += '"'
          i++
        } else if (c === '"') {
          inQuotes = false
        } else {
          cell += c
        }
      } else if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        pushCell()
      } else if (c === '\n') {
        pushCell()
        pushRow()
      } else {
        cell += c
      }
    }
    if (cell.length > 0 || row.length > 0) {
      pushCell()
      pushRow()
    }

    const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''))
    if (nonEmpty.length === 0) return { headers: [], rows: [] }

    const headers = nonEmpty[0].map((h) => h.trim())
    const data = nonEmpty.slice(1).map((cells) => {
      const obj = {}
      headers.forEach((h, idx) => {
        obj[h] = (cells[idx] ?? '').trim()
      })
      return obj
    })
    return { headers, rows: data }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FORMATTING
  // ───────────────────────────────────────────────────────────────────────────
  function formatPrice(row) {
    if (!row) return ''
    return [row.price, row.currency].filter(Boolean).join(' ')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CACHE (localStorage) — миттєвий рендер на повторних візитах
  // ───────────────────────────────────────────────────────────────────────────
  function loadFromCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.rows)) return null
      return parsed
    } catch {
      return null
    }
  }

  function saveToCache(data) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rows: data.rows, savedAt: Date.now() }),
      )
    } catch {
      // quota / private mode — не критично
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LOADER
  // ───────────────────────────────────────────────────────────────────────────
  function withCacheBuster(url) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}t=${Date.now()}`
  }

  async function fetchPricing() {
    if (!PRICING_CSV_URL) {
      return parseCSV(MOCK_CSV)
    }
    try {
      const res = await fetch(withCacheBuster(PRICING_CSV_URL), {
        cache: 'no-cache',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      return parseCSV(text)
    } catch (err) {
      console.warn(
        '[pricing] не вдалось завантажити CSV, використовую мок-дані:',
        err,
      )
      return parseCSV(MOCK_CSV)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDERER
  // ───────────────────────────────────────────────────────────────────────────
  function render(data) {
    if (!data || !data.rows) return
    const byKey = new Map(data.rows.map((r) => [r.key, r]))
    document.querySelectorAll('[data-price]').forEach((el) => {
      const row = byKey.get(el.dataset.price)
      if (!row) {
        console.warn(`[pricing] відсутній ключ "${el.dataset.price}" у даних`)
        return
      }
      const next = formatPrice(row)
      if (el.textContent !== next) el.textContent = next
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INIT — двофазний рендер
  //   1) синхронно з кешу (якщо є) — щоб не було порожніх місць
  //   2) фоновим fetch'ем оновлюємо, якщо у таблиці щось змінилось
  // ───────────────────────────────────────────────────────────────────────────
  const init = async () => {
    const cached = loadFromCache()
    if (cached) render(cached)

    try {
      const fresh = await fetchPricing()
      render(fresh)
      saveToCache(fresh)
    } catch (err) {
      console.error('[pricing] init failed:', err)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
