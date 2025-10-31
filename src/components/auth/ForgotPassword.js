import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EnvelopeIcon, ArrowLeftIcon, ArrowRightIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [errors, setErrors] = useState({})

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    // Validaciones
    if (!email) {
      setErrors({ email: 'El email es requerido' })
      return
    }

    if (!validateEmail(email)) {
      setErrors({ email: 'Por favor ingresa un email válido' })
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast.error('Tu email no ha sido confirmado. Revisa tu bandeja de entrada.')
        } else {
          toast.error('Error al enviar el email de recuperación')
        }
        console.error('Error:', error)
        return
      }

      setEmailSent(true)
      toast.success('Email de recuperación enviado exitosamente')
    } catch (error) {
      console.error('Error sending reset email:', error)
      toast.error('Error al enviar el email de recuperación')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex">
        {/* Panel Izquierdo - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 relative overflow-hidden">
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
                <p className="text-green-100 text-lg">Recuperación segura</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-3">🔐 Protección de Datos</h3>
                <p className="text-green-100">
                  Tu seguridad es nuestra prioridad. Proceso de recuperación encriptado y seguro.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-3">⚡ Recuperación Rápida</h3>
                <p className="text-green-100">
                  Recupera el acceso a tu cuenta en minutos con nuestro sistema automatizado.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-3">📧 Email Seguro</h3>
                <p className="text-green-100">
                  Enlace de recuperación válido por 24 horas con acceso único y seguro.
                </p>
              </div>
            </div>
            
            <div className="mt-12 flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Email Enviado</p>
                <p className="text-green-100 text-sm">Revisa tu bandeja de entrada</p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Derecho - Confirmación */}
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
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <EnvelopeIcon className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">
                Email enviado
              </h2>
              <p className="text-lg text-white">
                Hemos enviado un enlace de recuperación a tu email
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <EnvelopeIcon className="h-6 w-6 text-green-400 mt-1" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Revisa tu email
                  </h3>
                  <div className="text-sm text-green-700 space-y-2">
                    <p>
                      Te hemos enviado un enlace de recuperación a <strong className="text-green-900">{email}</strong>.
                    </p>
                    <p>
                      Haz clic en el enlace del email para restablecer tu contraseña.
                    </p>
                    <p className="text-xs text-green-600">
                      El enlace expirará en 24 horas por seguridad.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => window.location.href = `mailto:${email}`}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
              >
                <EnvelopeIcon className="h-5 w-5" />
                <span>Abrir cliente de email</span>
              </button>

              <Link
                to="/login"
                className="w-full bg-transparent border border-green-600 text-green-600 hover:bg-green-50 font-semibold py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Volver al inicio de sesión</span>
              </Link>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center">
              <p className="text-xs text-white">
                © 2024 Brify AI. Todos los derechos reservados.
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex">
      {/* Panel Izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 relative overflow-hidden">
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
              <p className="text-green-100 text-lg">Recupera tu acceso</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">🔐 ¿Olvidaste tu contraseña?</h3>
              <p className="text-green-100">
                No te preocupes. Te ayudaremos a recuperar el acceso a tu cuenta de forma segura y rápida.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">🛡️ Máxima Seguridad</h3>
              <p className="text-green-100">
                Nuestro proceso de recuperación utiliza encriptación de extremo a extremo para proteger tus datos.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">⏰ Acceso Rápido</h3>
              <p className="text-green-100">
                Recibe un enlace único y válido por 24 horas para restablecer tu contraseña al instante.
              </p>
            </div>
          </div>
          
          <div className="mt-12 flex items-center space-x-4">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
              <LockClosedIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">Seguridad Garantizada</p>
              <p className="text-green-100 text-sm">Protección de nivel empresarial</p>
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
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <LockClosedIcon className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">
              ¿Olvidaste tu contraseña?
            </h2>
            <p className="text-lg text-white">
              Ingresa tu email y te enviaremos un enlace para restablecerla
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
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
                  className={`w-full pl-12 pr-4 py-4 border ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-green-500 focus:ring-green-500'} rounded-2xl focus:ring-2 focus:outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400`}
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar enlace de recuperación</span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-semibold text-green-600 hover:text-green-500 transition-colors duration-200"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Volver al inicio de sesión
              </Link>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-white">
              © 2024 Brify AI. Todos los derechos reservados.
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
  )
}

export default ForgotPassword