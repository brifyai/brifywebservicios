import React from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 mt-12">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-600">© 2025 Brify AI</p>
        <Link 
          to="/condiciones"
          className="text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          CONDICIONES DE SERVICIOS
        </Link>
      </div>
    </footer>
  )
}

export default Footer