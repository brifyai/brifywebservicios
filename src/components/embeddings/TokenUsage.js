import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import embeddingsService from '../../lib/embeddings';
import {
  ChartBarIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const TokenUsage = () => {
  const { user } = useAuth();
  const [tokenStats, setTokenStats] = useState(null);
  const [tokenLimits, setTokenLimits] = useState(null);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  const loadTokenData = useCallback(async () => {
    if (loadingRef.current) {
      return; // Evitar múltiples llamadas simultáneas
    }
    
    try {
      loadingRef.current = true;
      setError(null);
      
      const [stats, limits] = await Promise.all([
        embeddingsService.getTokenUsageStats(user.id),
        embeddingsService.checkTokenLimits(user.id)
      ]);

      setTokenStats(stats || {
        total_tokens: 0,
        by_operation: {},
        records: []
      });
      setTokenLimits(limits || {
        tokens_used: 0,
        token_limit: 1000,
        remaining_tokens: 1000,
        usage_percentage: 0
      });
    } catch (err) {
      console.error('TokenUsage: Error loading token data:', err);
      setError('Error al cargar datos de tokens');
      
      // Establecer datos por defecto en caso de error
      setTokenStats({
        total_tokens: 0,
        by_operation: {},
        records: []
      });
      setTokenLimits({
        tokens_used: 0,
        token_limit: 1000,
        remaining_tokens: 1000,
        usage_percentage: 0
      });
    } finally {
      loadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (user && !loadingRef.current) {
      loadTokenData();
    } else if (!user) {
      // Si no hay usuario, establecer estado por defecto
      setTokenStats(null);
      setTokenLimits(null);
    }
  }, [user]); // Removida dependencia loadTokenData para evitar loop infinito

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageIcon = (percentage) => {
    if (percentage >= 90) return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    if (percentage >= 70) return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mr-2" />
          <span className="text-red-600">{error}</span>
        </div>
      </div>
    );
  }

  const usagePercentage = tokenLimits?.usage_percentage || 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <CpuChipIcon className="h-5 w-5 mr-2" />
            Uso de Tokens
          </h3>
          <button
            onClick={loadTokenData}
            className="text-sm text-blue-600 hover:text-blue-800"
            disabled={loadingRef.current}
          >
            Actualizar
          </button>
        </div>

        {/* Resumen de uso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tokens Usados</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(tokenLimits?.tokens_used || 0)}
                </p>
              </div>
              <CpuChipIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Límite</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(tokenLimits?.token_limit || 1000)}
                </p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(tokenLimits?.remaining_tokens || 1000)}
                </p>
              </div>
              {getUsageIcon(usagePercentage)}
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uso actual</span>
            <span className={`text-sm font-medium ${getUsageColor(usagePercentage)}`}>
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                usagePercentage >= 90
                  ? 'bg-red-600'
                  : usagePercentage >= 70
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Estadísticas por operación */}
        {tokenStats?.by_operation && Object.keys(tokenStats.by_operation).length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Uso por Operación</h4>
            <div className="space-y-2">
              {Object.entries(tokenStats.by_operation).map(([operation, count]) => (
                <div key={operation} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 capitalize">{operation}</span>
                  <span className="text-sm font-medium text-gray-900">{formatNumber(count)} tokens</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historial reciente */}
        {tokenStats?.records && tokenStats.records.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Actividad Reciente</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {tokenStats.records.slice(0, 5).map((record, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 capitalize">{record.operation}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">
                      {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900">{formatNumber(record.tokens_used)} tokens</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenUsage;