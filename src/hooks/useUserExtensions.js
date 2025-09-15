import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export const useUserExtensions = () => {
  const { user } = useAuth()
  const [userExtensions, setUserExtensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadUserExtensions = useCallback(async () => {
    if (!user?.id) {
      setUserExtensions([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Función auxiliar para reintentos con cola
      const retryQuery = async (queryFn, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await queryFn()
            if (result.error) throw result.error
            return result
          } catch (error) {
            console.warn(`Intento ${attempt}/${maxRetries} falló en useUserExtensions:`, error.message)
            if (attempt === maxRetries) throw error
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          }
        }
      }

      // Usar la misma consulta que funciona en el Dashboard con reintentos
      const { data: extensionsData } = await retryQuery(async () => {
        return await supabase
          .from('plan_extensiones')
          .select(`
            *,
            extensiones (
              id,
              name,
              name_es,
              description,
              description_es,
              price_usd,
              disponible
            )
          `)
          .eq('user_id', user.id)
      })

      setUserExtensions(extensionsData || [])
    } catch (err) {
      console.error('Error loading user extensions:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setUserExtensions([])
      setLoading(false)
      return
    }

    loadUserExtensions()
  }, [user, loadUserExtensions])

  // Función para verificar si el usuario tiene una extensión específica por nombre
  const hasExtension = (extensionName) => {
    return userExtensions.some(
      ext => ext.extensiones?.name === extensionName || ext.extensiones?.name_es === extensionName
    )
  }

  // Función para verificar si el usuario tiene una extensión específica por ID
  const hasExtensionById = (extensionId) => {
    return userExtensions.some(
      ext => ext.extension_id === extensionId
    )
  }

  // Función para obtener una extensión específica por nombre
  const getExtensionByName = (extensionName) => {
    return userExtensions.find(
      ext => ext.extensiones?.name === extensionName || ext.extensiones?.name_es === extensionName
    )
  }

  // Función para obtener todas las extensiones activas
  const getActiveExtensions = () => {
    return userExtensions.filter(
      ext => ext.extensiones?.disponible === true
    )
  }

  return {
    userExtensions,
    loading,
    error,
    hasExtension,
    hasExtensionById,
    getExtensionByName,
    getActiveExtensions,
    refetch: loadUserExtensions
  }
}

export default useUserExtensions