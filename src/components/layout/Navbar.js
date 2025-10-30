import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  HomeIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  CubeIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

const Navbar = () => {
  const { user, userProfile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [plans, setPlans] = useState([])
  const [extensions, setExtensions] = useState([])
  const [isExtensionsMenuOpen, setIsExtensionsMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Cargar planes disponibles
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
        if (!error && data) {
          setPlans(data)
        }
      } catch (error) {
        console.error('Error loading plans:', error)
      }
    }
    
    loadPlans()
  }, [])

  // Cargar extensiones del usuario
  useEffect(() => {
    const loadExtensions = async () => {
      if (!user) return
      
      try {
        const { data, error } = await supabase
          .from('plan_extensiones')
          .select(`
            *,
            extensiones (
              id,
              name,
              name_es,
              description,
              description_es,
              price,
              disponible
            )
          `)
          .eq('user_id', user.id)
        
        if (!error && data) {
          setExtensions(data)
        }
      } catch (error) {
        console.error('Error loading extensions:', error)
      }
    }
    
    loadExtensions()
  }, [user])

  // Cerrar menú de extensiones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isExtensionsMenuOpen && !event.target.closest('.extensions-menu-container')) {
        setIsExtensionsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExtensionsMenuOpen])

  // Obtener nombre del plan por ID
  const getPlanName = () => {
    if (!userProfile?.current_plan_id) return 'Sin plan'
    const plan = plans.find(p => p.id === userProfile.current_plan_id)
    return plan?.name || plan?.name_es || 'Plan desconocido'
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Mi Perfil', href: '/profile', icon: UserIcon },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white border-b border-gray-100 shadow-none sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo y navegación principal */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="flex items-center group">
                <div className="w-8 h-8 bg-black rounded-lg shadow-sm group-hover:shadow-md transition-all duration-300 flex items-center justify-center mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-lg font-semibold text-gray-900 group-hover:text-black transition-colors duration-300">
                  Brify AI
                </span>
              </Link>
            </div>

            {/* Navegación desktop */}
            <div className="hidden ml-8 lg:flex lg:items-center lg:space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActiveLink = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`relative inline-flex items-center px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                      isActiveLink
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-2 transition-all duration-300 ${
                      isActiveLink
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`} />
                    {item.name}
                  </Link>
                )
              })}

              {/* Menú Extensiones Contratadas */}
              <div className="relative extensions-menu-container">
                <button
                  onClick={() => setIsExtensionsMenuOpen(!isExtensionsMenuOpen)}
                  className={`relative inline-flex items-center px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isExtensionsMenuOpen
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <CubeIcon className={`w-4 h-4 mr-2 transition-all duration-300 ${
                    isExtensionsMenuOpen
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`} />
                  Extensiones Contratadas
                  <ChevronDownIcon className={`w-3 h-3 ml-1 transition-all duration-300 ${
                    isExtensionsMenuOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Submenú de Extensiones */}
                {isExtensionsMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-2">
                      {extensions.length > 0 ? (
                        extensions.map((ext) => {
                          const extension = ext.extensiones
                          return (
                            <div
                              key={ext.id}
                              className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {extension?.name_es || extension?.name || 'Extensión'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {extension?.description_es || extension?.description || 'Sin descripción'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="px-4 py-3">
                          <div className="text-sm text-gray-500 text-center">
                            No tienes extensiones contratadas
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Información del usuario y menú */}
          <div className="hidden lg:flex lg:items-center lg:space-x-3">
            {/* Información del plan */}
            {userProfile && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    userProfile.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    {getPlanName()}
                  </span>
                </div>
                {userProfile.is_active && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Activo
                  </span>
                )}
              </div>
            )}

            {/* Menú de usuario */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700">
                    {user?.email}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-lg transition-all duration-300"
              >
                <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 mr-1.5 text-white" />
                Salir
              </button>
            </div>
          </div>

          {/* Botón menú móvil */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-300"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" />
              ) : (
                <Bars3Icon className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 pt-4 pb-3">
            {/* Logo en móvil */}
            <div className="flex items-center mb-4 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Brify AI
              </span>
            </div>

            {/* Navegación móvil */}
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActiveLink = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      isActiveLink
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-4 h-4 mr-3 ${
                        isActiveLink ? 'text-gray-900' : 'text-gray-400'
                      }`} />
                      {item.name}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Extensiones Contratadas en móvil */}
            <div className="my-4">
              <button
                onClick={() => setIsExtensionsMenuOpen(!isExtensionsMenuOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isExtensionsMenuOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center">
                  <CubeIcon className={`w-4 h-4 mr-3 ${
                    isExtensionsMenuOpen ? 'text-gray-900' : 'text-gray-400'
                  }`} />
                  Extensiones Contratadas
                </div>
                <ChevronDownIcon className={`w-3 h-3 transition-all duration-300 ${
                  isExtensionsMenuOpen ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Submenú de Extensiones en móvil */}
              {isExtensionsMenuOpen && (
                <div className="mt-2 ml-3 mr-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="py-2">
                    {extensions.length > 0 ? (
                      extensions.map((ext) => {
                        const extension = ext.extensiones
                        return (
                          <div
                            key={ext.id}
                            className="px-4 py-3 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                          >
                            <div className="flex items-center">
                              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {extension?.name_es || extension?.name || 'Extensión'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {extension?.description_es || extension?.description || 'Sin descripción'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="px-4 py-3">
                        <div className="text-sm text-gray-500 text-center">
                          No tienes extensiones contratadas
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Separador */}
            <div className="my-4 border-t border-gray-200"></div>

            {/* Información del usuario en móvil */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.email}
                  </span>
                </div>
              </div>

              {/* Información del plan */}
              {userProfile && (
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    userProfile.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    {getPlanName()}
                  </span>
                </div>
              )}
            </div>

            {/* Botón de logout */}
            <div className="mt-4 mb-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all duration-300"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2 text-white" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar