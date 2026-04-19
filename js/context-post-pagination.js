(() => {
  const CONTEXT_KEY = 'postNavContext'
  const CONTEXT_INDEX_PATH = '/context-pagination.json'
  let contextIndexCache = null
  let clickBound = false

  const safeDecode = value => {
    try {
      return decodeURIComponent(value)
    } catch (_) {
      return value
    }
  }

  const normalizePathKey = pathname => {
    const clean = String(pathname || '')
      .split('#')[0]
      .split('?')[0]
      .replace(/^\/+|\/+$/g, '')
    if (!clean) return ''
    return clean
      .split('/')
      .map(part => safeDecode(part))
      .join('/')
  }

  const normalizePostPath = pathname => {
    const key = normalizePathKey(pathname)
    return key ? `${key}/` : ''
  }

  const isSameOriginLink = href => {
    try {
      const target = new URL(href, window.location.origin)
      return target.origin === window.location.origin
    } catch (_) {
      return false
    }
  }

  const isPrimaryNavigationClick = event => (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )

  const isPostPath = key => /^\d{4}\/\d{2}\/\d{2}\/.+/.test(key)

  const inferListContextByPath = pathname => {
    const key = normalizePathKey(pathname)
    if (key.startsWith('tags/')) return { type: 'tag', key }
    if (key.startsWith('categories/')) return { type: 'category', key }
    return null
  }

  const isHomeOrArchivePath = pathname => {
    const key = normalizePathKey(pathname)
    return key === '' || /^page\/\d+$/.test(key) || key === 'archives' || key.startsWith('archives/')
  }

  const readContext = () => {
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !parsed.type || !parsed.key) return null
      if (!['tag', 'category'].includes(parsed.type)) return null
      return { type: parsed.type, key: String(parsed.key), updatedAt: parsed.updatedAt || Date.now() }
    } catch (_) {
      return null
    }
  }

  const saveContext = context => {
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({
        type: context.type,
        key: context.key,
        updatedAt: Date.now()
      }))
    } catch (_) {}
  }

  const clearContext = () => {
    try {
      sessionStorage.removeItem(CONTEXT_KEY)
    } catch (_) {}
  }

  const inferContextFromReferrer = () => {
    if (!document.referrer) return { context: null, isHomeOrArchive: false }

    try {
      const ref = new URL(document.referrer)
      if (ref.origin !== window.location.origin) return { context: null, isHomeOrArchive: false }
      const refContext = inferListContextByPath(ref.pathname)
      if (refContext) return { context: refContext, isHomeOrArchive: false }
      return { context: null, isHomeOrArchive: isHomeOrArchivePath(ref.pathname) }
    } catch (_) {
      return { context: null, isHomeOrArchive: false }
    }
  }

  const loadContextIndex = async () => {
    if (contextIndexCache) return contextIndexCache
    const response = await fetch(CONTEXT_INDEX_PATH, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`Failed to load ${CONTEXT_INDEX_PATH}`)
    contextIndexCache = await response.json()
    return contextIndexCache
  }

  const getPostNavSlots = pagination => {
    const slots = { prev: null, next: null }
    pagination.querySelectorAll('a.pagination-related').forEach(link => {
      const info = link.querySelector('.info')
      const side = info && info.classList.contains('text-right') ? 'next' : 'prev'
      slots[side] = link
    })
    return slots
  }

  const updateLink = (link, targetPath, title) => {
    if (!link) return
    if (!targetPath) {
      link.style.display = 'none'
      return
    }

    link.style.display = ''
    link.href = `/${targetPath}`
    if (title) link.title = title
    const titleEl = link.querySelector('.info-item-2')
    if (titleEl && title) titleEl.textContent = title
  }

  const rewritePaginationByContext = async () => {
    if (document.body.getAttribute('data-type') !== 'post') return
    const pagination = document.querySelector('nav#pagination.pagination-post')
    if (!pagination) return

    let context = readContext()
    const ref = inferContextFromReferrer()
    if (ref.context) {
      saveContext(ref.context)
      context = ref.context
    } else if (ref.isHomeOrArchive) {
      clearContext()
      context = null
    }

    if (!context) return

    try {
      const data = await loadContextIndex()
      const key = context.type === 'tag' ? 'tags' : 'categories'
      const pool = data && data[key] ? data[key] : {}
      const sequence = pool[context.key]
      if (!Array.isArray(sequence) || !sequence.length) return

      const currentPath = normalizePostPath(window.location.pathname)
      const currentIndex = sequence.indexOf(currentPath)
      if (currentIndex === -1) return

      const prevPath = currentIndex > 0 ? sequence[currentIndex - 1] : null
      const nextPath = currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null
      const titles = data && data.titles ? data.titles : {}
      const slots = getPostNavSlots(pagination)

      updateLink(slots.prev, prevPath, prevPath ? titles[prevPath] : '')
      updateLink(slots.next, nextPath, nextPath ? titles[nextPath] : '')

      if (!prevPath && !nextPath) {
        pagination.style.display = 'none'
      } else {
        pagination.style.display = ''
      }
    } catch (_) {}
  }

  const bindEntryContextHandler = () => {
    if (clickBound) return
    clickBound = true

    document.addEventListener('click', event => {
      if (!isPrimaryNavigationClick(event)) return
      const anchor = event.target.closest('a[href]')
      if (!anchor) return
      if (!isSameOriginLink(anchor.href)) return

      const target = new URL(anchor.href, window.location.origin)
      const targetKey = normalizePathKey(target.pathname)
      if (!isPostPath(targetKey)) return

      const pageContext = inferListContextByPath(window.location.pathname)
      if (pageContext) {
        saveContext(pageContext)
      } else if (isHomeOrArchivePath(window.location.pathname)) {
        clearContext()
      }
    }, true)
  }

  const run = () => {
    bindEntryContextHandler()
    rewritePaginationByContext()
  }

  document.addEventListener('DOMContentLoaded', run)
  window.addEventListener('pjax:complete', run)
})()
