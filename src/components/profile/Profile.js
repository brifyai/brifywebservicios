import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import { GoogleDriveService } from '../../lib/googleDrive'
import {
  UserIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  CloudIcon,
  CreditCardIcon,
  CalendarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const Profile = () => {
  const { user, userProfile, updateUserProfile, loadUserProfile, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [payments, setPayments] = useState([])
  const [stats, setStats] = useState({
    totalFolders: 0,
    totalFiles: 0,
    storageUsed: 0,
    tokensUsed: 0
  })
  
  const [formData, setFormData] = useState({
    full_name: '',
    telegram_id: ''
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [googleDriveService] = useState(new GoogleDriveService())

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        telegram_id: userProfile.telegram_id || ''
      })
    }
    loadPaymentHistory()
    loadUserStats()
  }, [userProfile])

  const loadPaymentHistory = async () => {
    try {
      const { data, error } = await db.payments.getByUserId(user.id)
      if (error) {
        console.error('Error loading payment history:', error)
        // En caso de error, establecer array vacío para evitar bloqueos
        setPayments([])
        return
      }
      setPayments(data || [])
    } catch (error) {
      console.error('Network error loading payment history:', error)
      setPayments([])
    }
  }

  const loadUserStats = async () => {
    try {
      // Usar datos del perfil de usuario para evitar consultas excesivas
      const basicStats = {
        totalFolders: 0, // Se puede obtener de userProfile si está disponible
        totalFiles: 0,   // Se puede obtener de userProfile si está disponible
        storageUsed: userProfile?.used_storage_bytes || 0,
        tokensUsed: 0
      }
      
      setStats(basicStats)
      
      // Cargar solo tokens usados con manejo de errores mejorado
      try {
        const { data: tokenUsage, error } = await supabase
          .from('user_tokens_usage')
          .select('total_tokens')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!error && tokenUsage) {
          setStats(prevStats => ({
            ...prevStats,
            tokensUsed: tokenUsage.total_tokens || 0
          }))
        }
      } catch (tokenError) {
        console.error('Error loading token usage:', tokenError)
        // No hacer nada, mantener tokensUsed en 0
      }
      
    } catch (error) {
      console.error('Error loading user stats:', error)
      // Establecer estadísticas básicas en caso de error
      setStats({
        totalFolders: 0,
        totalFiles: 0,
        storageUsed: userProfile?.used_storage_bytes || 0,
        tokensUsed: 0
      })
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      await updateUserProfile(formData)
      toast.success('Perfil actualizado exitosamente')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Error actualizando el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    
    setSaving(true)
    
    try {
      // Cambiar contraseña con Supabase
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })
      
      if (error) {
        console.error('Error:', error)
        
        // Manejar errores específicos de Supabase
        if (error.message && error.message.includes('New password should be different from the old password')) {
          toast.error('La nueva contraseña debe ser diferente a la anterior')
        } else if (error.message && error.message.includes('Password should be at least')) {
          toast.error('La contraseña debe cumplir con los requisitos mínimos')
        } else {
          toast.error('Error al actualizar la contraseña')
        }
        return
      }
      
      toast.success('Contraseña actualizada exitosamente')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setShowPasswordForm(false)
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Error cambiando la contraseña')
    } finally {
      setSaving(false)
    }
  }

  const handleGoogleDriveConnect = async () => {
    try {
      setLoading(true)
      
      // Generar URL de autorización de Google
      const authUrl = await googleDriveService.generateAuthUrl()
      
      // Abrir ventana de autorización
      window.open(authUrl, '_blank', 'width=500,height=600')
      
      toast.success('Redirigiendo a Google para autorización...')
    } catch (error) {
      console.error('Error connecting to Google Drive:', error)
      toast.error('Error conectando con Google Drive')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleDriveDisconnect = async () => {
    if (window.confirm('¿Estás seguro de que quieres desconectar Google Drive?')) {
      return
    }
    
    try {
      setLoading(true)
      
      // Limpiar tokens de Google Drive
      await updateUserProfile({
        google_refresh_token: null,
        google_access_token: null
      })
      
      toast.success('Google Drive desconectado exitosamente')
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error)
      toast.error('Error desconectando Google Drive')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      'paid': { color: 'bg-green-100 text-green-800', text: 'Completado' },
      'pending': { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      'failed': { color: 'bg-red-100 text-red-800', text: 'Fallido' },
      'cancelled': { color: 'bg-gray-100 text-gray-800', text: 'Cancelado' }
    }
    
    const config = statusConfig[status] || statusConfig['pending']
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    )
  }

  if (loading) {
    return <LoadingSpinner text="Cargando perfil..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-600 mt-1">
          Gestiona tu información personal y configuración de cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información Personal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del Usuario */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Información Personal
            </h2>
            
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Tu nombre completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El email no se puede modificar
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID de Telegram (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.telegram_id}
                  onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="@tu_usuario_telegram"
                />
              </div>
              
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>

          {/* Cambiar Contraseña */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <KeyIcon className="h-5 w-5 mr-2" />
              Seguridad
            </h2>
            
            {!showPasswordForm ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Cambia tu contraseña para mantener tu cuenta segura
                </p>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cambiar Contraseña
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña Actual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      })
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Cambiando...' : 'Cambiar Contraseña'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Historial de Pagos */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCardIcon className="h-5 w-5 mr-2" />
              Historial de Pagos
            </h2>
            
            {payments.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No tienes pagos registrados
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.amount_usd)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPaymentStatusBadge(payment.payment_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.payment_ref}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Google Drive */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CloudIcon className="h-5 w-5 mr-2" />
              Google Drive
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                {userProfile?.google_refresh_token ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span className="text-sm text-gray-700">
                  {userProfile?.google_refresh_token ? 'Conectado' : 'No conectado'}
                </span>
              </div>
              
              {userProfile?.google_refresh_token ? (
                <button
                  onClick={handleGoogleDriveDisconnect}
                  disabled={loading}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Desconectando...' : 'Desconectar'}
                </button>
              ) : (
                <button
                  onClick={handleGoogleDriveConnect}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Conectando...' : 'Conectar Google Drive'}
                </button>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Estadísticas
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Carpetas</span>
                <span className="text-sm font-medium text-gray-900">{stats.totalFolders}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Archivos</span>
                <span className="text-sm font-medium text-gray-900">{stats.totalFiles}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Almacenamiento</span>
                <span className="text-sm font-medium text-gray-900">{formatFileSize(stats.storageUsed)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tokens usados</span>
                <span className="text-sm font-medium text-gray-900">{stats.tokensUsed.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Información de la Cuenta */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Información de Cuenta
            </h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-600">Miembro desde</span>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(userProfile?.created_at)}
                </p>
              </div>
              
              <div>
                <span className="text-sm text-gray-600">Plan actual</span>
                <p className="text-sm font-medium text-gray-900">
                  {userProfile?.current_plan_id || 'Sin plan'}
                </p>
              </div>
              
              <div>
                <span className="text-sm text-gray-600">Estado</span>
                <p className="text-sm font-medium text-gray-900">
                  {userProfile?.is_active ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
          </div>

          {/* Cerrar Sesión */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <button
              onClick={signOut}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile