import React, { useState, useEffect } from "react";
import { adminApi } from "../../services/api";
import {
  User,
  UserRole,
  CreateUserRequest,
  UpdateUserRequest,
} from "../../types";
import { getUserRoleLabel } from "../../utils";

interface UserFormData {
  name: string;
  username: string;
  password: string;
  roles: UserRole[];
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
    roles: [UserRole.MANAGER],
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
      roles: [UserRole.MANAGER],
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
      roles:
        user.roles && user.roles.length > 0
          ? [...new Set(user.roles)]
          : [user.role],
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
      roles: [UserRole.MANAGER],
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
    if (!formData.roles || formData.roles.length === 0) {
      errors.roles = "Выберите хотя бы одну роль";
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
        const updateData: UpdateUserRequest = {
          name: formData.name,
          username: formData.username,
          role: formData.roles[0],
          roles: formData.roles,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await adminApi.updateUser(editingUser.id, updateData);
        alert("Пользователь успешно обновлен");
      } else {
        const createData: CreateUserRequest = {
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.roles[0],
          roles: formData.roles,
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

  const roleBadgeClass = (role: UserRole): string => {
    switch (role) {
      case UserRole.ADMIN:
        return "bg-purple-100 text-purple-800";
      case UserRole.LICENSE_MANAGER:
        return "bg-amber-100 text-amber-900";
      case UserRole.PRESIDIUM_MEMBER:
        return "bg-indigo-100 text-indigo-900";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const toggleRole = (role: UserRole) => {
    setFormData((prev) => {
      const exists = prev.roles.includes(role);
      const roles = exists
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return {
        ...prev,
        roles,
      };
    });
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
                Роли
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
                  <div className="flex flex-wrap gap-1">
                    {(user.roles && user.roles.length > 0
                      ? user.roles
                      : [user.role]
                    ).map((role) => (
                      <span
                        key={`${user.id}-${role}`}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(
                          role
                        )}`}
                      >
                        {getUserRoleLabel(role)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => openEditModal(user)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">
              {editingUser
                ? "Редактирование пользователя"
                : "Новый пользователь"}
            </h2>

            <form onSubmit={handleSubmit}>
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

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Роли *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(UserRole.MANAGER)}
                      onChange={() => toggleRole(UserRole.MANAGER)}
                      className="mr-2"
                    />
                    <span>{getUserRoleLabel(UserRole.MANAGER)}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(UserRole.LICENSE_MANAGER)}
                      onChange={() => toggleRole(UserRole.LICENSE_MANAGER)}
                      className="mr-2"
                    />
                    <span>{getUserRoleLabel(UserRole.LICENSE_MANAGER)}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(UserRole.PRESIDIUM_MEMBER)}
                      onChange={() => toggleRole(UserRole.PRESIDIUM_MEMBER)}
                      className="mr-2"
                    />
                    <span>{getUserRoleLabel(UserRole.PRESIDIUM_MEMBER)}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(UserRole.ADMIN)}
                      onChange={() => toggleRole(UserRole.ADMIN)}
                      className="mr-2"
                    />
                    <span>{getUserRoleLabel(UserRole.ADMIN)}</span>
                  </label>
                </div>
                {formErrors.roles && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.roles}</p>
                )}
              </div>

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
