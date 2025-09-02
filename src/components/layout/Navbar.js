import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  HomeIcon, 
  FolderIcon, 
  DocumentIcon, 
  CreditCardIcon, 
  UserIcon, 
  Bars3Icon, 
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

const Navbar = () => {
  const { user, userProfile, signOut, hasActivePlan } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [plans, setPlans] = useState([])

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

  // Obtener nombre del plan por ID
  const getPlanName = () => {
    if (!userProfile?.current_plan_id) return 'Sin plan'
    const plan = plans.find(p => p.id === userProfile.current_plan_id)
    return plan?.name || plan?.name_es || 'Plan desconocido'
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Carpetas', href: '/folders', icon: FolderIcon },
    { name: 'Archivos', href: '/files', icon: DocumentIcon },
    ...(hasActivePlan() ? [{ name: 'Búsqueda IA', href: '/search', icon: MagnifyingGlassIcon }] : []),
    
    { name: 'Planes', href: '/plans', icon: CreditCardIcon },
    { name: 'Perfil', href: '/profile', icon: UserIcon },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="navbar-container">
        <div className="flex justify-between h-16">
          {/* Logo y navegación principal */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="text-2xl font-bold text-primary-600">
                Webrify
              </Link>
            </div>
            
            {/* Navegación desktop */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Información del usuario y menú */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Información del plan */}
            {userProfile && (
              <div className="mr-4 text-sm text-gray-600">
                <span className="font-medium">
                  {getPlanName()}
                </span>
                {userProfile.is_active && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Activo
                  </span>
                )}
              </div>
            )}

            {/* Menú de usuario */}
            <div className="relative">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                  Salir
                </button>
              </div>
            </div>
          </div>

          {/* Botón menú móvil */}
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
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
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                </Link>
              )
            })}
          </div>
          
          {/* Información del usuario en móvil */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {user?.email}
                </div>
                {userProfile && (
                  <div className="text-sm text-gray-500">
                    {getPlanName()}
                    {userProfile.is_active && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Activo
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <button
                onClick={handleSignOut}
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
              >
                <div className="flex items-center">
                  <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                  Cerrar Sesión
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar