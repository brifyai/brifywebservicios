import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../common/SEO'

const TermsOfService = () => {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch('/condiciones_de_uso.text')
        if (!res.ok) throw new Error('No se pudo cargar el archivo de condiciones')
        const text = await res.text()
        setContent(text)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTerms()
  }, [])

  const renderFormattedContent = (text) => {
    const lines = text.split(/\r?\n/)
    const elements = []
    let i = 0

    const pushSpacer = (key) => elements.push(<div key={key} className="h-2" />)

    while (i < lines.length) {
      const raw = lines[i]
      const line = raw.trim()
      const keyBase = `ln-${i}`

      if (!line) {
        pushSpacer(`${keyBase}-sp`)
        i++
        continue
      }

      if (i === 0 && /condiciones/i.test(line)) {
        elements.push(
          <h1 key={keyBase} className="text-2xl font-bold text-gray-900 mb-2">
            {line}
          </h1>
        )
        i++
        continue
      }

      if (/^Última actualización/i.test(line)) {
        elements.push(
          <p key={keyBase} className="text-sm text-gray-500 mb-4">
            {line}
          </p>
        )
        i++
        continue
      }

      const section = line.match(/^(\d+)\.\s+(.*)$/)
      if (section) {
        elements.push(
          <h2 key={keyBase} className="text-lg font-semibold text-gray-900 mt-6 mb-2">
            {section[1]}. {section[2]}
          </h2>
        )
        i++
        continue
      }

      if (line.startsWith('•') || line.startsWith('-')) {
        const items = []
        while (i < lines.length) {
          const l = lines[i].trim()
          if (l.startsWith('•') || l.startsWith('-')) {
            items.push(l.replace(/^([•\-])\s?/, ''))
            i++
          } else {
            break
          }
        }
        elements.push(
          <ul key={keyBase} className="list-disc list-inside space-y-1 text-gray-800">
            {items.map((it, idx) => (
              <li key={`${keyBase}-item-${idx}`}>{it}</li>
            ))}
          </ul>
        )
        continue
      }

      elements.push(
        <p key={keyBase} className="text-gray-800 text-sm leading-relaxed">
          {line}
        </p>
      )
      i++
    }

    return elements
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Condiciones de Servicio"
        description="Términos y condiciones de uso de Brify AI"
        noIndex={true}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            Volver
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Condiciones de Servicio</h1>
          {loading && (
            <p className="text-gray-600">Cargando condiciones...</p>
          )}
          {error && (
            <p className="text-red-600">{error}</p>
          )}
          {!loading && !error && (
            <div className="prose max-w-none">
              {renderFormattedContent(content)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TermsOfService