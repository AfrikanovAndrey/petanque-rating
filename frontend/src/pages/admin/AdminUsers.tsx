import React, { useState, useEffect } from "react";
import { adminApi } from "../../services/api";
import {
  User,
  UserRole,
  CreateUserRequest,
  UpdateUserRequest,
} from "../../types";

interface UserFormData {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    username: "",
    password: "",
    role: UserRole.MANAGER,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getUsers();
      if (response.data.success && response.data.users) {
        setUsers(response.data.users);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      username: "",
      password: "",
      role: UserRole.MANAGER,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      password: "",
      role: user.role,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: "",
      username: "",
      password: "",
      role: UserRole.MANAGER,
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Имя обязательно";
    }

    if (!formData.username.trim()) {
      errors.username = "Логин обязателен";
    }

    if (!editingUser && !formData.password) {
      errors.password = "Пароль обязателен";
    }

    if (formData.password && formData.password.length < 6) {
      errors.password = "Пароль должен содержать минимум 6 символов";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (editingUser) {
        // Обновление пользователя
        const updateData: UpdateUserRequest = {
          name: formData.name,
          username: formData.username,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await adminApi.updateUser(editingUser.id, updateData);
        alert("Пользователь успешно обновлен");
      } else {
        // Создание пользователя
        const createData: CreateUserRequest = {
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.role,
        };
        await adminApi.createUser(createData);
        alert("Пользователь успешно создан");
      }
      closeModal();
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка сохранения пользователя");
    }
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (
      !confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?`)
    ) {
      return;
    }

    try {
      await adminApi.deleteUser(userId);
      alert("Пользователь успешно удален");
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка удаления пользователя");
    }
  };

  const getRoleText = (role: UserRole): string => {
    return role === UserRole.ADMIN ? "Администратор" : "Организатор турнира";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Управление пользователями</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Добавить пользователя
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Имя
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Логин
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Роль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата создания
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.username}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === UserRole.ADMIN
                        ? "bg-purple-100 text-purple-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {getRoleText(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Пользователи не найдены
          </div>
        )}
      </div>

      {/* Модальное окно */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">
              {editingUser
                ? "Редактирование пользователя"
                : "Новый пользователь"}
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Имя */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Фамилия Имя *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Иванов Иван"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Логин */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Логин *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.username ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="ivanov"
                />
                {formErrors.username && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.username}
                  </p>
                )}
              </div>

              {/* Пароль */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Пароль{" "}
                  {editingUser ? "(оставьте пустым, чтобы не менять)" : "*"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.password ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Минимум 6 символов"
                />
                {formErrors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.password}
                  </p>
                )}
              </div>

              {/* Роль */}
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Роль *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="role"
                      value={UserRole.MANAGER}
                      checked={formData.role === UserRole.MANAGER}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Организатор турнира</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="role"
                      value={UserRole.ADMIN}
                      checked={formData.role === UserRole.ADMIN}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Администратор</span>
                  </label>
                </div>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingUser ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
