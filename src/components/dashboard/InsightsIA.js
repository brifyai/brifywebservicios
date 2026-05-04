import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  CpuChipIcon, 
  DocumentTextIcon,
  LightBulbIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import insightsService from '../../services/insightsService';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

const InsightsIA = () => {
  const { user } = useAuth();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.email) {
      loadInsights();
    }
  }, [user]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await insightsService.getInsightsData(user.email);
      setInsights(data);
    } catch (err) {
      console.error('Error loading insights:', err);
      setError('Error al cargar los insights');
      setInsights(insightsService.getDefaultInsights());
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (percentage) => {
    if (percentage > 0) {
      return `+${percentage}%`;
    } else if (percentage < 0) {
      return `${percentage}%`;
    }
    return '0%';
  };

  const getPercentageColor = (percentage) => {
    if (percentage > 0) return 'text-green-600';
    if (percentage < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getPercentageIcon = (percentage) => {
    if (percentage > 0) return <ArrowTrendingUpIcon className="h-4 w-4" />;
    if (percentage < 0) return <ArrowTrendingDownIcon className="h-4 w-4" />;
    return null;
  };

  const getRecommendationIcon = (tipo) => {
    switch (tipo) {
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Insights de IA</h2>
          <LightBulbIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Insights de IA</h2>
          <LightBulbIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-500">{error}</p>
          <button 
            onClick={loadInsights}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Insights de IA</h2>
        <div className="flex items-center space-x-2">
          <LightBulbIcon className="h-6 w-6 text-gray-400" />
          <span className="text-sm text-gray-500">Recomendaciones personalizadas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recomendaciones - OCULTA */}
        {/* 
        <div className="lg:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recomendaciones</h3>
          <div className="space-y-3">
            {insights?.recomendaciones?.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                {getRecommendationIcon(rec.tipo)}
                <p className="text-sm text-gray-700 flex-1">{rec.mensaje}</p>
              </div>
            ))}
          </div>
        </div>
        */}

        {/* Tendencias */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Tendencias</h3>
          <div className="space-y-4">
            {/* Búsquedas */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <ChartBarIcon className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Búsquedas</span>
                </div>
                <div className={`flex items-center space-x-1 ${getPercentageColor(insights?.tendencias?.busquedas?.porcentaje)}`}>
                  {getPercentageIcon(insights?.tendencias?.busquedas?.porcentaje)}
                  <span className="text-sm font-medium">
                    {formatPercentage(insights?.tendencias?.busquedas?.porcentaje)}
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {insights?.tendencias?.busquedas?.total || 0}
              </p>
            </div>

            {/* Tokens Usados */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <CpuChipIcon className="h-5 w-5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Tokens usados</span>
                </div>
                <div className={`flex items-center space-x-1 ${getPercentageColor(insights?.tendencias?.tokensUsados?.porcentaje - 100)}`}>
                  <span className="text-sm font-medium">
                    {insights?.tendencias?.tokensUsados?.porcentaje}%
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {insights?.tendencias?.tokensUsados?.total || 0}
              </p>
              <p className="text-xs text-gray-500">
                de {insights?.tendencias?.tokensUsados?.limite || 1500} disponibles
              </p>
            </div>

            {/* Documentos Procesados */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <DocumentTextIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">Documentos procesados</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {insights?.tendencias?.documentosProcesados?.total || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Resúmenes Automáticos */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resúmenes Automáticos</h3>
          <div className="space-y-4">
            {/* Actividad Semanal */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Actividad semanal</h4>
              </div>
              <p className="text-sm text-blue-800">
                {insights?.resumenSemanal?.actividadSemanal}
              </p>
            </div>

            {/* Uso de IA */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2 mb-3">
                <CpuChipIcon className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium text-purple-900">Uso de IA</h4>
              </div>
              <p className="text-sm text-purple-800 mb-2">
                {insights?.resumenSemanal?.usoIA}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center p-2 bg-white rounded">
                  <p className="font-medium text-purple-900">Conversaciones</p>
                  <p className="text-lg font-bold text-purple-600">
                    {insights?.usoIA?.conversaciones || 0}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded">
                  <p className="font-medium text-purple-900">Tokens</p>
                  <p className="text-lg font-bold text-purple-600">
                    {insights?.usoIA?.tokensUtilizados || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón de actualización */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={loadInsights}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Actualizar</span>
        </button>
      </div>
    </div>
  );
};

export default InsightsIA;