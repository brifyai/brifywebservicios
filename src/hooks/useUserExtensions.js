import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { executeQuery } from '../lib/queryQueue'

// Cache compartido para evitar múltiples consultas simultáneas
const extensionsCache = new Map()
const loadingPromises = new Map()

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

    const cacheKey = `extensions_${user.id}`
    
    // Verificar si ya tenemos datos en caché
    if (extensionsCache.has(cacheKey)) {
      const cachedData = extensionsCache.get(cacheKey)
      setUserExtensions(cachedData)
      setLoading(false)
      setError(null)
      return
    }

    // Verificar si ya hay una consulta en progreso para este usuario
    if (loadingPromises.has(cacheKey)) {
      try {
        const result = await loadingPromises.get(cacheKey)
        setUserExtensions(result)
        setLoading(false)
        setError(null)
        return
      } catch (err) {
        setError(err)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      // Crear promesa de carga y almacenarla
      const loadingPromise = (async () => {
        // Usar el sistema de cola global para la consulta
        const { data: extensionsData } = await executeQuery(async () => {
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
                price,
                disponible
              )
            `)
            .eq('user_id', user.id)
        })

        const result = extensionsData || []
        
        // Guardar en caché por 5 minutos
        extensionsCache.set(cacheKey, result)
        setTimeout(() => {
          extensionsCache.delete(cacheKey)
        }, 5 * 60 * 1000)

        return result
      })()

      loadingPromises.set(cacheKey, loadingPromise)

      const result = await loadingPromise
      setUserExtensions(result)
      
      // Limpiar la promesa de carga
      loadingPromises.delete(cacheKey)
      
    } catch (err) {
      console.error('Error loading user extensions:', err)
      setError(err)
      loadingPromises.delete(cacheKey)
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

  // Función para limpiar el caché y recargar
  const clearCacheAndRefetch = useCallback(async () => {
    if (user?.id) {
      const cacheKey = `extensions_${user.id}`
      extensionsCache.delete(cacheKey)
      loadingPromises.delete(cacheKey)
      await loadUserExtensions()
    }
  }, [user, loadUserExtensions])

  return {
    userExtensions,
    loading,
    error,
    hasExtension,
    hasExtensionById,
    getExtensionByName,
    getActiveExtensions,
    refetch: loadUserExtensions,
    clearCacheAndRefetch
  }
}

export default useUserExtensions