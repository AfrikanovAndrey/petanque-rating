import React, { useState, useEffect } from "react";

interface LicensedPlayer {
  id: number;
  license_number: string;
  player_name: string;
  city: string;
  license_date: string;
  year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Statistics {
  total: number;
  active: number;
  cities: { city: string; count: number }[];
}

const AdminLicensedPlayers: React.FC = () => {
  const [players, setPlayers] = useState<LicensedPlayer[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<LicensedPlayer | null>(
    null
  );
  const [formData, setFormData] = useState({
    license_number: "",
    player_name: "",
    city: "",
    license_date: "",
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    loadData();
    loadYears();
    loadStatistics();
  }, [selectedYear]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const loadData = async () => {
    try {
      const params = selectedYear ? `?year=${selectedYear}` : "";
      const response = await fetch(`/api/admin/licensed-players${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setPlayers(data.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки лицензированных игроков:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadYears = async () => {
    try {
      const response = await fetch("/api/admin/licensed-players/years", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setYears(data.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки годов:", error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(
        `/api/admin/licensed-players/statistics?year=${selectedYear}`,
        {
          headers: getAuthHeaders(),
        }
      );
      const data = await response.json();
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
    }
  };

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploading(true);

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/licensed-players/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        alert(
          `Загрузка завершена!\nСоздано: ${data.results.created}\nОбновлено: ${data.results.updated}`
        );
        if (data.results.errors.length > 0) {
          console.warn("Ошибки при загрузке:", data.results.errors);
        }
        loadData();
        loadStatistics();
        loadYears();
      } else {
        alert(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error("Ошибка загрузки файла:", error);
      alert("Ошибка при загрузке файла");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingPlayer
        ? `/api/admin/licensed-players/${editingPlayer.id}`
        : "/api/admin/licensed-players";

      const method = editingPlayer ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        setEditingPlayer(null);
        setFormData({
          license_number: "",
          player_name: "",
          city: "",
          license_date: "",
          year: new Date().getFullYear(),
        });
        loadData();
        loadStatistics();
      } else {
        alert(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      alert("Ошибка при сохранении");
    }
  };

  const handleEdit = (player: LicensedPlayer) => {
    setEditingPlayer(player);
    setFormData({
      license_number: player.license_number,
      player_name: player.player_name,
      city: player.city,
      license_date: player.license_date.split("T")[0],
      year: player.year,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этого лицензированного игрока?")) return;

    try {
      const response = await fetch(`/api/admin/licensed-players/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (data.success) {
        loadData();
        loadStatistics();
      } else {
        alert(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error("Ошибка удаления:", error);
      alert("Ошибка при удалении");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Лицензированные игроки
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Добавить игрока
        </button>
      </div>

      {/* Статистика */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.total}
            </div>
            <div className="text-gray-600">Всего игроков</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {statistics.active}
            </div>
            <div className="text-gray-600">Активных игроков</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {statistics.cities.length}
            </div>
            <div className="text-gray-600">Городов</div>
          </div>
        </div>
      )}

      {/* Загрузка файла */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Загрузить из Excel файла</h2>
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Excel файл
              </label>
              <input
                type="file"
                name="licensed_players_file"
                accept=".xlsx,.xls"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Год
              </label>
              <input
                type="number"
                name="year"
                min="2000"
                max="2100"
                defaultValue={new Date().getFullYear()}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="replace_existing"
                  value="true"
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Заменить существующих
                </span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
          >
            {uploading ? "Загрузка..." : "Загрузить файл"}
          </button>
        </form>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Год
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Все годы</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Таблица игроков */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  № Лицензии
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ФИО
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Город
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата лицензии
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Год
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {player.license_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {player.player_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {player.city}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(player.license_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {player.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        player.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {player.is_active ? "Активен" : "Неактивен"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(player)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(player.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {players.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Нет лицензированных игроков для отображения
          </div>
        )}
      </div>

      {/* Модальное окно для добавления/редактирования */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingPlayer ? "Редактировать игрока" : "Добавить игрока"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    № Лицензии
                  </label>
                  <input
                    type="text"
                    value={formData.license_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        license_number: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ФИО
                  </label>
                  <input
                    type="text"
                    value={formData.player_name}
                    onChange={(e) =>
                      setFormData({ ...formData, player_name: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Город
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Дата лицензии
                  </label>
                  <input
                    type="date"
                    value={formData.license_date}
                    onChange={(e) =>
                      setFormData({ ...formData, license_date: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Год
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        year: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    min="2000"
                    max="2100"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingPlayer(null);
                    setFormData({
                      license_number: "",
                      player_name: "",
                      city: "",
                      license_date: "",
                      year: new Date().getFullYear(),
                    });
                  }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLicensedPlayers;
