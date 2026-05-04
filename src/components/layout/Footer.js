import React from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
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
