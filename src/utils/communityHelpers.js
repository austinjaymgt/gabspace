// Pure helpers shared by community.js and the Community components — no
// imports, so they're safe to use from anywhere (including node tests).

// One accepted response → the thread summary the Messages tab renders.
export function toThread(response, myBusinessSpaceIds, lastMessage, unread) {
  const req = response.collab_requests
  const iPosted = myBusinessSpaceIds.includes(req.business_space_id)
  return {
    response_id: response.id,
    request_id: req.id,
    request_title: req.title,
    role: iPosted ? 'poster' : 'responder',
    my_business_space_id: iPosted ? req.business_space_id : response.responder_business_space_id,
    counterpart_business_space_id: iPosted ? response.responder_business_space_id : req.business_space_id,
    counterpart_name: (iPosted ? response.responder_display_name : req.poster_display_name) || 'A business',
    started_at: response.created_at,
    last_message: lastMessage || null,
    unread,
  }
}

export function byLastActivity(a, b) {
  const at = t => new Date(t.last_message?.created_at || t.started_at)
  return at(b) - at(a)
}

// "lumaphoto.com" → "https://lumaphoto.com"; blank → null. The database
// only accepts http(s) URLs.
export function normalizeWebsite(value) {
  const v = value?.trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export function isValidWebsite(value) {
  const v = normalizeWebsite(value)
  if (!v) return true
  try {
    const url = new URL(v)
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') && !/\s/.test(v) && v.length <= 200
  } catch {
    return false
  }
}

// "@luma.photo", "instagram.com/luma.photo/", or a full URL → "luma.photo";
// blank → null. Stored without the @.
export function normalizeInstagram(value) {
  let v = value?.trim()
  if (!v) return null
  const fromUrl = v.match(/instagram\.com\/([^/?#]+)/i)
  if (fromUrl) v = fromUrl[1]
  return v.replace(/^@+/, '')
}

export function isValidInstagram(value) {
  const v = normalizeInstagram(value)
  return !v || /^[A-Za-z0-9._]{1,30}$/.test(v)
}

export function instagramUrl(handle) {
  return `https://instagram.com/${handle}`
}

// Cities are free-typed, so matching is loose: case and extra spaces are
// ignored (see cityMatches for the search rules).
export function cityKey(city) {
  return city?.trim().replace(/\s+/g, ' ').toLowerCase() || ''
}

const US_STATES = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado',
  ct: 'connecticut', de: 'delaware', dc: 'district of columbia', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky',
  la: 'louisiana', me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota',
  oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia',
  wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
}
const STATE_NAMES = Object.entries(US_STATES).sort((a, b) => b[1].length - a[1].length) // "west virginia" before "virginia"

// A city plus its US state spelled both ways, so "Austin, TX" is also
// searchable as "texas" and "Austin, Texas" as "tx". A two-letter code only
// counts as a state when it ends the city ("Denver, CO"), so "La Jolla"
// isn't read as Louisiana.
function citySearchText(city) {
  const base = cityKey(city).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!base) return ''
  const extra = []
  const last = base.split(' ').pop()
  if (US_STATES[last] && base.includes(' ')) extra.push(US_STATES[last])
  for (const [code, name] of STATE_NAMES) {
    if (` ${base} `.includes(` ${name} `)) { extra.push(code); break }
  }
  return [base, ...extra].join(' ')
}

// Every word typed must appear somewhere in the city (state names and
// abbreviations are interchangeable): "austin texas", "tx", and "aus" all
// find "Austin, TX".
export function cityMatches(city, query) {
  const words = cityKey(query).replace(/[.,]/g, ' ').split(' ').filter(Boolean)
  if (!words.length) return true
  const text = citySearchText(city)
  return words.every(w => text.includes(w))
}

// Distinct cities for type-ahead suggestions — spellings that differ only
// by case/spacing collapse into one, labelled with the most common spelling.
export function citySuggestions(listings) {
  const groups = new Map()
  for (const l of listings) {
    const key = cityKey(l.city)
    if (!key) continue
    const label = l.city.trim().replace(/\s+/g, ' ')
    const counts = groups.get(key) || {}
    counts[label] = (counts[label] || 0) + 1
    groups.set(key, counts)
  }
  return [...groups.values()]
    .map(counts => Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
    .sort((a, b) => a.localeCompare(b))
}

// Tidies a free-typed city into "City, ST" for US states, so the same place
// is stored the same way across listings and requests:
//   "austin,  tx" / "Austin Texas" / "austin, texas"  →  "Austin, TX"
//   "washington dc"                                   →  "Washington, DC"
//   "Toronto, Ontario"                                →  unchanged
// Capitalization is only fixed when the city was typed all-lower or
// all-upper, so names like "McKinney" or "DeLand" are left alone.
export function formatCity(value) {
  const v = value?.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ')
  if (!v) return null

  let city = v
  let region = null
  const comma = v.lastIndexOf(',')
  if (comma !== -1) {
    city = v.slice(0, comma).trim()
    region = v.slice(comma + 1).trim()
  } else {
    const lower = v.toLowerCase()
    const words = lower.split(' ')
    const name = STATE_NAMES.find(([, n]) => lower.endsWith(` ${n}`))
    if (name) {
      city = v.slice(0, v.length - name[1].length).trim()
      region = name[1]
    } else if (words.length > 1 && US_STATES[words.at(-1)]) {
      city = v.slice(0, v.lastIndexOf(' ')).trim()
      region = words.at(-1)
    }
  }

  if (city === city.toLowerCase() || city === city.toUpperCase()) {
    city = city.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
  }
  if (!region) return city || null

  const key = region.toLowerCase().replace(/\./g, '')
  const code = US_STATES[key] ? key : STATE_NAMES.find(([, n]) => n === key)?.[0]
  return `${city}, ${code ? code.toUpperCase() : region}`
}

// Stable "random" pick from n options for a string (tag key, business id),
// so a business or tag always gets the same color.
export function pickIndex(str, n) {
  let h = 0
  for (const ch of String(str || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return h % n
}
