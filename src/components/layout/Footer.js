import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight
      const threshold = document.documentElement.scrollHeight - 4 // pequeño margen
      setAtBottom(scrolled >= threshold)
    }

    // Comprobar al cargar y al hacer scroll/resize
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  if (!atBottom) return null

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} Brify AI</p>
        <Link
          to="/condiciones"
          className="text-xs font-semibold tracking-wider uppercase text-gray-700 hover:text-black"
        >
          CONDICIONES DE SERVICIO
        </Link>
      </div>
    </footer>
  )
}

export default Footer