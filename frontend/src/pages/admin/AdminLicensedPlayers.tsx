import React, { useState, useEffect, useRef } from "react";

interface LicensedPlayer {
  id: number;
  license_number: string;
  player_name: string;
  city: string;
  license_date: string;
  year: number;
  created_at: string;
  updated_at: string;
}

interface Statistics {
  total: number;
  cities: { city: string; count: number }[];
}

interface Player {
  id: number;
  name: string;
  city: string | null;
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
    player_name: "",
    license_date: "",
  });

  // Состояния для автодополнения
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadYears();
    loadStatistics();
  }, [selectedYear]);

  useEffect(() => {
    if (showModal && !editingPlayer) {
      loadAllPlayers();
    }
  }, [showModal]);

  // Закрытие списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const loadAllPlayers = async () => {
    try {
      const response = await fetch("/api/admin/players", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setAllPlayers(data.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки игроков:", error);
    }
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
          `Загрузка завершена!\nСоздано: ${data.results.success}\nОбновлено: ${data.results.updated}\nОшибок: ${data.results.errors.length}`
        );
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
    // Валидация: игрок должен быть выбран из списка
    if (!editingPlayer && !selectedPlayerId) {
      alert("Пожалуйста, выберите игрока из списка");
      return;
    }

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
          player_name: "",
          license_date: "",
        });
        // Очищаем состояние автодополнения
        setShowSuggestions(false);
        setFilteredPlayers([]);
        setActiveSuggestionIndex(0);
        setSelectedPlayerId(null);
        setSearchQuery("");
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
      player_name: player.player_name,
      license_date: player.license_date.split("T")[0],
    });
    setSearchQuery(player.player_name); // Устанавливаем имя игрока в поле поиска
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

  // Обработчик изменения поля ФИО с автодополнением
  const handlePlayerNameChange = (value: string) => {
    setSearchQuery(value);
    setSelectedPlayerId(null); // Сбрасываем выбор при изменении
    setFormData({ ...formData, player_name: "" }); // Очищаем имя

    if (value.trim().length > 0) {
      const filtered = allPlayers.filter((player) =>
        player.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPlayers(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setFilteredPlayers([]);
    }
  };

  // Выбор игрока из списка
  const handleSelectPlayer = (player: Player) => {
    setFormData({ ...formData, player_name: player.name });
    setSearchQuery(player.name);
    setSelectedPlayerId(player.id);
    setShowSuggestions(false);
    setFilteredPlayers([]);
  };

  // Обработка клавиш для навигации по списку
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < filteredPlayers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredPlayers[activeSuggestionIndex]) {
        handleSelectPlayer(filteredPlayers[activeSuggestionIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
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
          type="button"
          onClick={() => {
            setShowModal(true);
            setSearchQuery("");
            setSelectedPlayerId(null);
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Добавить лицензию
        </button>
      </div>

      {/* Статистика */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.total}
            </div>
            <div className="text-gray-600">Всего игроков</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(player)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
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
                {editingPlayer ? "Редактировать лицензию" : "Добавить лицензию"}
              </h3>
              <div className="space-y-4">
                <div className="relative" ref={suggestionsRef}>
                  <label className="block text-sm font-medium text-gray-700">
                    ФИО игрока
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handlePlayerNameChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (searchQuery && filteredPlayers.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      selectedPlayerId
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Начните вводить ФИО игрока"
                    disabled={!!editingPlayer}
                    required
                    autoComplete="off"
                  />
                  {!editingPlayer && !selectedPlayerId && (
                    <p className="mt-1 text-sm text-red-500">
                      ⚠️ Выберите игрока из списка
                    </p>
                  )}
                  {!editingPlayer && selectedPlayerId && (
                    <p className="mt-1 text-sm text-green-600">
                      ✓ Игрок выбран
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Можно выбрать существующего игрока. В случае отсутствия -
                    игрока нужно предварительно создать в разделе "Игроки"
                  </p>

                  {/* Список автодополнения */}
                  {showSuggestions &&
                    !editingPlayer &&
                    filteredPlayers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredPlayers.map((player, index) => (
                          <div
                            key={player.id}
                            onClick={() => handleSelectPlayer(player)}
                            className={`px-3 py-2 cursor-pointer ${
                              index === activeSuggestionIndex
                                ? "bg-blue-100 text-blue-900"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            <div className="font-medium">{player.name}</div>
                            {player.city && (
                              <div className="text-xs text-gray-500">
                                {player.city}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
                    min={`${new Date().getFullYear()}-01-01`}
                    max={`${new Date().getFullYear()}-12-31`}
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Можно указать дату только для текущего{" "}
                    {new Date().getFullYear()} года
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingPlayer(null);
                    setFormData({
                      player_name: "",
                      license_date: "",
                    });
                    // Очищаем состояние автодополнения
                    setShowSuggestions(false);
                    setFilteredPlayers([]);
                    setActiveSuggestionIndex(0);
                    setSelectedPlayerId(null);
                    setSearchQuery("");
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
