import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HelmetProvider } from 'react-helmet-async'

// Servicios
import { weeklyReportService } from './services/weeklyReportService'

// Componentes
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import Dashboard from './components/dashboard/Dashboard'
import Plans from './components/plans/Plans'
import Folders from './components/folders/Folders'
import Files from './components/files/Files'
import Profile from './components/profile/Profile'
import SemanticSearch from './components/embeddings/SemanticSearch'
import Abogado from './components/legal/Abogado'
import LoadingSpinner from './components/common/LoadingSpinner'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Condiciones from './components/legal/Condiciones'
import GoogleAuthCallback from './components/auth/GoogleAuthCallback'
import Entrenador from './components/trainer/Entrenador'


// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />
}

// Componente para rutas públicas (solo para usuarios no autenticados)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  return !isAuthenticated ? children : <Navigate to="/dashboard" />
}

// Layout principal para rutas autenticadas
const AuthenticatedLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

function App() {
  // Inicializar sistema de resúmenes semanales automáticos
  useEffect(() => {
    // Programar resúmenes semanales automáticos
    weeklyReportService.scheduleWeeklyReports()
    
    console.log('Sistema de insights de IA inicializado')
  }, [])

  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <div className="App">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: '#4aed88',
                },
              },
              error: {
                duration: 4000,
                theme: {
                  primary: '#ff4b4b',
                },
              },
            }}
          />
          
          <Routes>
            {/* Rutas públicas */}
            <Route 
              path="/condiciones" 
              element={<Condiciones />} 
            />
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            <Route 
              path="/forgot-password" 
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              } 
            />
            <Route 
              path="/reset-password" 
              element={
                <ResetPassword />
              } 
            />
            
            {/* Callback de Google Auth */}
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
            
            {/* Rutas protegidas */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Dashboard />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/plans" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Plans />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/folders" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Folders />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/files" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Files />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Profile />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <SemanticSearch />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/abogado"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Abogado />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/entrenador"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Entrenador />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

            
            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            
            {/* Ruta 404 */}
            <Route 
              path="*" 
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-8">Página no encontrada</p>
                    <a 
                      href="/dashboard" 
                      className="btn-primary inline-block"
                    >
                      Volver al Dashboard
                    </a>
                  </div>
                </div>
              } 
            />
          </Routes>
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  )
}

export default App
