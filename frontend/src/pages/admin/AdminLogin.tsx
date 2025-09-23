import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { authApi } from "../../services/api";
import { LoginCredentials } from "../../types";
import { handleApiError, isAuthenticated } from "../../utils";

const AdminLogin: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  // Перенаправляем, если уже авторизован
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin/dashboard");
    }
  }, [navigate]);

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);

      if (response.data.success && response.data.token) {
        localStorage.setItem("admin_token", response.data.token);
        toast.success("Успешная авторизация!");
        navigate("/admin/dashboard");
      } else {
        toast.error(response.data.message || "Ошибка авторизации");
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Логотип и заголовок */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Вход в админ панель
          </h2>
          <p className="text-gray-600">Система управления рейтингом игроков</p>
        </div>

        {/* Форма входа */}
        <form className="card p-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Имя пользователя
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className={`input-field ${
                errors.username ? "border-red-300 focus:ring-red-500" : ""
              }`}
              placeholder="Введите имя пользователя"
              {...register("username", {
                required: "Имя пользователя обязательно",
                minLength: {
                  value: 3,
                  message:
                    "Имя пользователя должно содержать минимум 3 символа",
                },
              })}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Пароль
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`input-field pr-10 ${
                  errors.password ? "border-red-300 focus:ring-red-500" : ""
                }`}
                placeholder="Введите пароль"
                {...register("password", {
                  required: "Пароль обязателен",
                  minLength: {
                    value: 4,
                    message: "Пароль должен содержать минимум 4 символа",
                  },
                })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="loading-spinner mr-2"></div>
                Вход...
              </>
            ) : (
              "Войти"
            )}
          </button>
        </form>

        {/* Ссылка на публичную страницу */}
        <div className="text-center">
          <a
            href="/"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            ← Вернуться к рейтингу
          </a>
        </div>

        {/* Информация для разработчика */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-center text-sm text-yellow-800">
            <p className="font-medium mb-1">Данные для входа по умолчанию:</p>
            <p>
              Логин: <span className="font-mono">admin</span>
            </p>
            <p>
              Пароль: <span className="font-mono">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
