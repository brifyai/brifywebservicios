import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon, EnvelopeIcon, ArrowRightIcon, PhoneIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import SEO from '../common/SEO'

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    telegramId: '',
    whatsapp: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const formatWhatsappNumber = (number) => {
    if (!number) return null
    const cleaned = number.replace(/\D/g, '')
    
    // Caso: 8 dígitos (ej: 96406106 o 50128073) -> Agregar 569
    if (cleaned.length === 8) return `569${cleaned}`
    // Caso: 9 dígitos y empieza con 9 (ej: 996406106) -> Agregar 56
    if (cleaned.length === 9 && cleaned.startsWith('9')) return `56${cleaned}`
    // Caso: 11 dígitos y empieza con 569 -> Dejar igual
    if (cleaned.length === 11 && cleaned.startsWith('569')) return cleaned
    
    return cleaned
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    }
    
    if (!formData.email) {
      newErrors.email = 'El email es requerido'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido'
    }
    
    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida'
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden'
    }
    
    // Telegram ID es opcional, pero si se proporciona debe ser válido
    if (formData.telegramId && !/^\d+$/.test(formData.telegramId)) {
      newErrors.telegramId = 'El ID de Telegram debe contener solo números'
    }

    // Whatsapp es opcional
    if (formData.whatsapp) {
      const formatted = formatWhatsappNumber(formData.whatsapp)
      // Validar que el resultado final sea un formato válido de 11 dígitos empezando con 569
      if (!formatted || formatted.length !== 11 || !formatted.startsWith('569')) {
        newErrors.whatsapp = 'Formato inválido. Ejemplos: +56996406106, 96406106 o 50128073'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const userData = {
        name: formData.name.trim(),
        telegram_id: formData.telegramId || null,
        wssp: formatWhatsappNumber(formData.whatsapp) || null
      }
      
      const { error } = await signUp(formData.email, formData.password, userData)
      
      if (!error) {
        navigate('/login')
      }
    } catch (error) {
      console.error('Error during registration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <SEO
          title="Cargando... | Brify AI"
          description="Creando cuenta en Brify AI"
          noIndex={true}
        />
        <LoadingSpinner text="Creando cuenta..." />
      </>
    )
  }

  // Structured data para la página de registro
  const registerStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Crear Cuenta - Brify AI",
    "description": "Regístrate en Brify AI y comienza a gestionar tus documentos con inteligencia artificial",
    "url": "https://brifyai.com/register",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Brify AI",
      "url": "https://brifyai.com"
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://brifyai.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Crear Cuenta",
          "item": "https://brifyai.com/register"
        }
      ]
    },
    "mainEntity": {
      "@type": "WebForm",
      "name": "Formulario de Registro",
      "description": "Formulario seguro para crear tu cuenta de Brify AI",
      "action": {
        "@type": "Action",
        "name": "Crear Cuenta",
        "target": "https://brifyai.com/register"
      }
    }
  }

  return (
    <>
      <SEO
        title="Crear Cuenta Gratis | Brify AI - Regístrate y Transforma tu Productividad"
        description="Regístrate gratis en Brify AI y accede a la gestión documental con IA. Chat con documentos, organización automática y productividad inteligente. Comienza ahora."
        keywords="crear cuenta brify ai, registrarse brify, signup brify ai, gestión documental gratuita, chat con documentos gratis, organización inteligente"
        canonicalUrl="https://brifyai.com/register"
        ogType="website"
        structuredData={registerStructuredData}
        additionalMeta={[
          { name: 'page-type', content: 'authentication' },
          { name: 'target-audience', content: 'new-users' },
          { name: 'user-intent', content: 'register' },
          { name: 'signup-type', content: 'free' }
        ]}
      />
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex">
      {/* Panel Izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 to-pink-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        
        {/* Patrón decorativo */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-20 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-white/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Brify AI</h1>
              <p className="text-purple-100 text-lg">Comienza tu viaje</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">🎯 Únete a la Revolución</h3>
              <p className="text-purple-100">
                Forma parte de la nueva era de la gestión documental con inteligencia artificial
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">⚡ Productividad Instantánea</h3>
              <p className="text-purple-100">
                Automatiza tareas repetitivas y enfócate en lo que realmente importa
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">🔒 Seguridad Garantizada</h3>
              <p className="text-purple-100">
                Tus datos están protegidos con encriptación de nivel empresarial
              </p>
            </div>
          </div>
          
          <div className="mt-12 flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Únete a la Comunidad</p>
              <p className="text-purple-100 text-sm">Más de 10,000 usuarios activos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-8 lg:px-16">
        <div className="max-w-md w-full">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="ml-3 text-2xl font-bold text-gray-900">Brify AI</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-white mb-2">
              Crea tu cuenta
            </h2>
            <p className="text-lg text-white">
              Comienza a transformar tu productividad hoy
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Nombre Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={`w-full pl-12 pr-4 py-4 border ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="Tu nombre completo"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              {errors.name && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`w-full pl-12 pr-4 py-4 border ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Telegram ID */}
            <div>
              <label htmlFor="telegramId" className="block text-sm font-semibold text-white mb-2">
                ID de Telegram <span className="text-gray-300">(Opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <input
                  id="telegramId"
                  name="telegramId"
                  type="text"
                  className={`w-full pl-12 pr-4 py-4 border ${errors.telegramId ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="123456789"
                  value={formData.telegramId}
                  onChange={handleChange}
                />
              </div>
              {errors.telegramId && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.telegramId}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Puedes encontrar tu ID de Telegram contactando a @userinfobot
              </p>
            </div>

            {/* Whatsapp */}
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-semibold text-white mb-2">
                Whatsapp <span className="text-gray-300">(Opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <PhoneIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="text"
                  className={`w-full pl-12 pr-4 py-4 border ${errors.whatsapp ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="Número de Whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                />
              </div>
              {errors.whatsapp && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.whatsapp}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`w-full pl-12 pr-12 py-4 border ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-white mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`w-full pl-12 pr-12 py-4 border ${errors.confirmPassword ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  <>
                    <span>Crear Cuenta</span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-6 border-t border-gray-200">
              <p className="text-white">
                ¿Ya tienes una cuenta?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-purple-600 hover:text-purple-500 transition-colors duration-200"
                >
                  Inicia sesión aquí
                </Link>
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-white">
                Al crear una cuenta, aceptas nuestros{' '}
                <a 
                  href="https://www.brifyai.com/terminos.html" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200"
                >
                  Términos de Servicio
                </a>{' '}
                y{' '}
                <a 
                  href="https://www.brifyai.com/privacidad.html" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200"
                >
                  Política de Privacidad
                </a>
              </p>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-white">
              © 2025 Brify AI. Todos los derechos reservados.
            </p>
            <div className="mt-2 flex justify-center space-x-4">
              <a 
                href="https://www.brifyai.com/privacidad.html" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white hover:text-gray-300 transition-colors"
              >
                Privacidad
              </a>
              <a 
                href="https://www.brifyai.com/terminos.html" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white hover:text-gray-300 transition-colors"
              >
                Términos
              </a>
              <button className="text-xs text-white hover:text-gray-300 transition-colors">
                Soporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default Register