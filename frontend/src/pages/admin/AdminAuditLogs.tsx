import React, { useState, useEffect } from "react";
import { adminApi } from "../../services/api";

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  user_role: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  entity_name?: string;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_url?: string;
  request_body?: any;
  changes?: any;
  success: boolean;
  error_message?: string;
  created_at: string;
}

interface AuditStatistics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  actionsByType: { action: string; count: number }[];
  actionsByUser: { username: string; count: number }[];
  actionsByEntity: { entity_type: string; count: number }[];
}

const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);

  // Фильтры
  const [filters, setFilters] = useState({
    username: "",
    action: "",
    entity_type: "",
    success: "",
    date_from: "",
    date_to: "",
  });

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [limit] = useState(50);

  // Списки для select
  const [actions, setActions] = useState<{ value: string; label: string }[]>(
    []
  );
  const [entityTypes, setEntityTypes] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    loadActions();
    loadEntityTypes();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, filters]);

  const loadActions = async () => {
    try {
      const response = await adminApi.getAuditActions();
      if (response.data.success) {
        setActions(response.data.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки списка действий:", err);
    }
  };

  const loadEntityTypes = async () => {
    try {
      const response = await adminApi.getAuditEntityTypes();
      if (response.data.success) {
        setEntityTypes(response.data.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки типов сущностей:", err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit,
        offset: (currentPage - 1) * limit,
      };

      if (filters.username) params.username = filters.username;
      if (filters.action) params.action = filters.action;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.success) params.success = filters.success === "true";
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await adminApi.getAuditLogs(params);
      if (response.data.success) {
        setLogs(response.data.data);
        setTotalLogs(response.data.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка загрузки логов аудита");
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const params: any = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await adminApi.getAuditStatistics(params);
      if (response.data.success) {
        setStatistics(response.data.data);
        setShowStatistics(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Ошибка загрузки статистики");
    }
  };

  const viewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      username: "",
      action: "",
      entity_type: "",
      success: "",
      date_from: "",
      date_to: "",
    });
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ru-RU");
  };

  const getActionLabel = (action: string) => {
    const found = actions.find((a) => a.value === action);
    return found ? found.label : action;
  };

  const getEntityTypeLabel = (entityType?: string) => {
    if (!entityType) return "-";
    const found = entityTypes.find((e) => e.value === entityType);
    return found ? found.label : entityType;
  };

  const totalPages = Math.ceil(totalLogs / limit);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Логи аудита</h1>
        <button
          onClick={loadStatistics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          📊 Статистика
        </button>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Фильтры</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пользователь
            </label>
            <input
              type="text"
              value={filters.username}
              onChange={(e) => handleFilterChange("username", e.target.value)}
              placeholder="Имя пользователя"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Действие
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Все действия</option>
              {actions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип сущности
            </label>
            <select
              value={filters.entity_type}
              onChange={(e) =>
                handleFilterChange("entity_type", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Все типы</option>
              {entityTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              value={filters.success}
              onChange={(e) => handleFilterChange("success", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Все</option>
              <option value="true">Успешно</option>
              <option value="false">Ошибка</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата от
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange("date_from", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата до
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange("date_to", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => loadLogs()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Применить фильтры
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Таблица логов */}
      {loading ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата/Время
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Пользователь
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Действие
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сущность
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    IP адрес
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Логи не найдены
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">
                          {log.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.user_role}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getActionLabel(log.action)}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs">
                        {log.entity_type ? (
                          <div>
                            <div className="font-medium text-gray-700 text-xs">
                              {getEntityTypeLabel(log.entity_type)}
                              {log.entity_id && (
                                <span className="text-gray-400 ml-1">
                                  #{log.entity_id}
                                </span>
                              )}
                            </div>
                            {log.entity_name && (
                              <div
                                className="text-sm text-gray-900 font-medium mt-0.5 truncate"
                                title={log.entity_name}
                              >
                                {log.entity_name}
                              </div>
                            )}
                            {log.description && !log.entity_name && (
                              <div
                                className="text-xs text-gray-500 mt-0.5 truncate"
                                title={log.description}
                              >
                                {log.description}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.ip_address || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.success ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            ✓ Успешно
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                            ✗ Ошибка
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => viewDetails(log)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Детали
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Показано {(currentPage - 1) * limit + 1} -{" "}
                {Math.min(currentPage * limit, totalLogs)} из {totalLogs}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  ← Назад
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded-lg ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно с деталями */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">
                  Детали записи аудита #{selectedLog.id}
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Дата/Время
                    </label>
                    <p className="text-gray-900">
                      {formatDate(selectedLog.created_at)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Статус
                    </label>
                    <p>
                      {selectedLog.success ? (
                        <span className="text-green-600">✓ Успешно</span>
                      ) : (
                        <span className="text-red-600">✗ Ошибка</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Пользователь
                    </label>
                    <p className="text-gray-900">
                      {selectedLog.username} ({selectedLog.user_role})
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Действие
                    </label>
                    <p className="text-gray-900">
                      {getActionLabel(selectedLog.action)}
                    </p>
                  </div>
                </div>

                {selectedLog.entity_type && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          Тип сущности
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {getEntityTypeLabel(selectedLog.entity_type)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          ID
                        </label>
                        <p className="text-gray-900 font-mono">
                          #{selectedLog.entity_id || "-"}
                        </p>
                      </div>
                    </div>
                    {selectedLog.entity_name && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-500">
                          Название
                        </label>
                        <p className="text-lg text-gray-900 font-semibold">
                          {selectedLog.entity_name}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedLog.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Описание
                    </label>
                    <p className="text-gray-900">{selectedLog.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      IP адрес
                    </label>
                    <p className="text-gray-900">
                      {selectedLog.ip_address || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      HTTP метод
                    </label>
                    <p className="text-gray-900">
                      {selectedLog.request_method || "-"}
                    </p>
                  </div>
                </div>

                {selectedLog.request_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      URL запроса
                    </label>
                    <p className="text-gray-900 text-sm break-all">
                      {selectedLog.request_url}
                    </p>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      User Agent
                    </label>
                    <p className="text-gray-900 text-xs break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}

                {selectedLog.request_body && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Тело запроса
                    </label>
                    <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.request_body, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.changes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Изменения
                    </label>
                    <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-60">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Сообщение об ошибке
                    </label>
                    <p className="text-red-600">{selectedLog.error_message}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно со статистикой */}
      {showStatistics && statistics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Статистика аудита</h2>
                <button
                  onClick={() => setShowStatistics(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Общая статистика */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Всего действий</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {statistics.totalActions}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Успешных</div>
                    <div className="text-2xl font-bold text-green-600">
                      {statistics.successfulActions}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Ошибок</div>
                    <div className="text-2xl font-bold text-red-600">
                      {statistics.failedActions}
                    </div>
                  </div>
                </div>

                {/* Действия по типам */}
                {statistics.actionsByType.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Действия по типам
                    </h3>
                    <div className="space-y-2">
                      {statistics.actionsByType
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-700">
                              {getActionLabel(item.action)}
                            </span>
                            <span className="font-semibold">{item.count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Действия по пользователям */}
                {statistics.actionsByUser.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Активность пользователей
                    </h3>
                    <div className="space-y-2">
                      {statistics.actionsByUser
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-700">
                              {item.username}
                            </span>
                            <span className="font-semibold">{item.count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Действия по сущностям */}
                {statistics.actionsByEntity.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Действия по типам сущностей
                    </h3>
                    <div className="space-y-2">
                      {statistics.actionsByEntity.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-700">
                            {getEntityTypeLabel(item.entity_type)}
                          </span>
                          <span className="font-semibold">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowStatistics(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
