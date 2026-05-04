export const escapeHtml = (input) => {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const escapeAttribute = (input) => {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const formatInline = (text) => {
  let s = text

  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>')

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = escapeAttribute(url)
    const safeLabel = label
    const isHttp = /^https?:\/\//i.test(url)
    const attrs = isHttp ? ' target="_blank" rel="noreferrer"' : ''
    return `<a href="${safeUrl}"${attrs}>${safeLabel}</a>`
  })

  return s
}

export const renderMarkdownLiteToHtml = (input) => {
  const text = escapeHtml(input).replace(/\r\n/g, '\n')
  const lines = text.split('\n')

  let html = ''
  let paragraphLines = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html += '</ul>'
      inUl = false
    }
    if (inOl) {
      html += '</ol>'
      inOl = false
    }
  }

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    closeLists()
    const body = formatInline(paragraphLines.join('<br/>'))
    html += `<p>${body}</p>`
    paragraphLines = []
  }

  for (const rawLine of lines) {
    const line = rawLine

    if (!line.trim()) {
      flushParagraph()
      closeLists()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      closeLists()
      const level = Math.min(6, headingMatch[1].length)
      const body = formatInline(headingMatch[2].trim())
      html += `<h${level}>${body}</h${level}>`
      continue
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      if (inOl) {
        html += '</ol>'
        inOl = false
      }
      if (!inUl) {
        html += '<ul>'
        inUl = true
      }
      html += `<li>${formatInline(ulMatch[1].trim())}</li>`
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      flushParagraph()
      if (inUl) {
        html += '</ul>'
        inUl = false
      }
      if (!inOl) {
        html += '<ol>'
        inOl = true
      }
      html += `<li>${formatInline(olMatch[1].trim())}</li>`
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph()
  closeLists()

  return html
}

