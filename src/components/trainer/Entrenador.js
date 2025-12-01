import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  ArrowDownTrayIcon,
  FolderIcon,
  UsersIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}

const Entrenador = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alumnoFolders, setAlumnoFolders] = useState([])
  const [groupFolders, setGroupFolders] = useState([])
  const [sharedByFolderId, setSharedByFolderId] = useState({})
  const [routines, setRoutines] = useState([])

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user?.email) {
          setLoading(false)
          return
        }

        const { data: alumno } = await supabase
          .from('carpetas_usuario')
          .select('id, correo, nombre_carpeta, created_at')
          .eq('administrador', user.email)

        const { data: grupos } = await supabase
          .from('grupos_drive')
          .select('id, nombre_grupo_low, group_name, folder_id, created_at')
          .eq('administrador', user.email)

        const folderIds = (grupos || []).map(g => g.folder_id).filter(Boolean)
        let sharedMap = {}
        if (folderIds.length > 0) {
          const { data: shared } = await supabase
            .from('grupos_carpetas')
            .select('carpeta_id, usuario_lector')
            .in('carpeta_id', folderIds)
            .eq('administrador', user.email)
          for (const rec of (shared || [])) {
            const key = rec.carpeta_id
            if (!sharedMap[key]) sharedMap[key] = []
            if (rec.usuario_lector) sharedMap[key].push(rec.usuario_lector)
          }
        }

        const { data: rutinas } = await supabase
          .from('rutinas')
          .select('id, user_email, administrador, updated_at')
          .eq('administrador', user.email)
          .order('updated_at', { ascending: false })
          .limit(50)

        setAlumnoFolders(alumno || [])
        setGroupFolders(grupos || [])
        setSharedByFolderId(sharedMap)
        setRoutines(rutinas || [])
      } catch (err) {
        console.error('Error cargando datos de Entrenador:', err)
        setError('No se pudieron cargar los datos')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Couh Deportivo</h1>
          <p className="text-sm text-gray-600">Gestiona carpetas de alumnos, grupos y rutinas</p>
        </div>
        <a
          href="/rutinap.xlsx"
          download
          className="inline-flex items-center px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          Descargar plantilla Excel
        </a>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alumno folders */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Carpetas Alumno</h2>
            <FolderIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-sm text-gray-600 mb-3">
            Total: <span className="font-semibold text-gray-900">{alumnoFolders.length}</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {alumnoFolders.length === 0 && (
              <div className="text-sm text-gray-500">No hay carpetas de alumnos aún</div>
            )}
            {alumnoFolders.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{f.nombre_carpeta || 'Carpeta'}</span>
                  <span className="text-xs text-gray-500">{f.correo}</span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(f.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Group folders */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Carpetas Grupo</h2>
            <UsersIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-sm text-gray-600 mb-3">
            Total: <span className="font-semibold text-gray-900">{groupFolders.length}</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {groupFolders.length === 0 && (
              <div className="text-sm text-gray-500">No hay carpetas de grupo aún</div>
            )}
            {groupFolders.map((g) => (
              <div key={g.id} className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{g.group_name || g.nombre_grupo_low || 'Grupo'}</span>
                  <span className="text-xs text-gray-500">{formatDate(g.created_at)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Compartida con: { (sharedByFolderId[g.folder_id] || []).length }
                  { (sharedByFolderId[g.folder_id] || []).length > 0 && (
                    <span className="ml-2 text-gray-500">{(sharedByFolderId[g.folder_id] || []).slice(0,3).join(', ')}{(sharedByFolderId[g.folder_id] || []).length > 3 ? '…' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Routines */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Rutinas</h2>
            <SparklesIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {routines.length === 0 && (
              <div className="text-sm text-gray-500">Aún no hay rutinas registradas</div>
            )}
            {routines.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{r.user_email}</span>
                  <span className="text-xs text-gray-500">Admin: {r.administrador}</span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(r.updated_at)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link to="/folders" className="text-xs text-teal-700 hover:underline inline-flex items-center">
              Abrir Gestionar Archivos
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Entrenador