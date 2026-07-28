import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import toast from "react-hot-toast";
import {
  BuildingLibraryIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import {
  Club,
  ClubMemberSummary,
  PlayerSearchResult,
  User,
  UserRole,
} from "../../types";
import { handleApiError, hasAnyUserRole, formatDate } from "../../utils";
import { PlayerAutocompleteField } from "../../components/PlayerAutocompleteField";

const AdminClubs: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [name, setName] = useState("");
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [members, setMembers] = useState<ClubMemberSummary[]>([]);
  const [memberPick, setMemberPick] = useState<PlayerSearchResult | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<ClubMemberSummary | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("current_user");
    if (cached) {
      try {
        setCurrentUser(JSON.parse(cached));
      } catch {
        /* ignore */
      }
    }
    adminApi.getCurrentUser().then((res) => {
      if (res.data.success && res.data.data) {
        setCurrentUser(res.data.data);
        localStorage.setItem("current_user", JSON.stringify(res.data.data));
      }
    });
  }, []);

  const isClubAdmin = hasAnyUserRole(currentUser, [
    UserRole.ADMIN,
    UserRole.PRESIDIUM_MEMBER,
  ]);

  const isOwnClub = (club: Club): boolean =>
    (club.owners ?? []).some((o) => o.user_id === currentUser?.id);

  /**
   * Владелец видит «Изменить» только у своего клуба.
   * ADMIN / PRESIDIUM — «Изменить» и «Удалить» у всех клубов.
   */
  const canEditClub = (club: Club): boolean =>
    isClubAdmin || isOwnClub(club);

  const canDeleteClub = (_club: Club): boolean => isClubAdmin;

  const { data: clubs = [], isLoading, error } = useQuery(
    "admin-clubs",
    async () => {
      const res = await adminApi.getClubs();
      return res.data.data ?? [];
    }
  );

  const { data: ownerCandidates = [] } = useQuery(
    "club-owner-candidates",
    async () => {
      const res = await adminApi.getClubOwnerCandidates();
      return res.data.data ?? [];
    },
    { enabled: isClubAdmin }
  );

  const deleteMutation = useMutation(
    (clubId: number) => adminApi.deleteClub(clubId),
    {
      onSuccess: () => {
        toast.success("Клуб удалён");
        queryClient.invalidateQueries("admin-clubs");
      },
      onError: (err: unknown) => {
        toast.error(handleApiError(err));
      },
    }
  );

  const openCreate = () => {
    setEditingClub(null);
    setName("");
    setOwnerIds([]);
    setMembers([]);
    setMemberPick(null);
    setLogoFile(null);
    setMemberToRemove(null);
    setIsModalOpen(true);
  };

  const openEdit = (club: Club) => {
    setEditingClub(club);
    setName(club.name);
    setOwnerIds((club.owners ?? []).map((o) => o.user_id));
    setMembers([...(club.members ?? [])]);
    setMemberPick(null);
    setLogoFile(null);
    setMemberToRemove(null);
    setIsModalOpen(true);
  };

  const addMember = (player: PlayerSearchResult | null) => {
    if (!player) {
      toast.error("Выберите игрока из списка");
      return;
    }
    if (members.some((m) => m.player_id === player.id)) {
      toast.error("Игрок уже в составе");
      setMemberPick(null);
      return;
    }
    setMembers((prev) => [
      ...prev,
      {
        player_id: player.id,
        player_name: player.name,
        created_at: new Date().toISOString(),
      },
    ]);
    setMemberPick(null);
  };

  const removeMember = (playerId: number) => {
    setMembers((prev) => prev.filter((m) => m.player_id !== playerId));
    setMemberToRemove(null);
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;
    removeMember(memberToRemove.player_id);
  };

  const toggleOwner = (userId: number) => {
    setOwnerIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Укажите название клуба");
      return;
    }
    setSaving(true);
    try {
      let clubId = editingClub?.id;
      if (editingClub) {
        const payload: {
          name: string;
          member_player_ids: number[];
          owner_user_ids?: number[];
        } = {
          name: name.trim(),
          member_player_ids: members.map((m) => m.player_id),
        };
        if (isClubAdmin) {
          payload.owner_user_ids = ownerIds;
        }
        await adminApi.updateClub(editingClub.id, payload);
        toast.success("Клуб обновлён");
      } else {
        const res = await adminApi.createClub({
          name: name.trim(),
          owner_user_ids: ownerIds,
          member_player_ids: members.map((m) => m.player_id),
        });
        clubId = res.data.data?.id;
        toast.success("Клуб создан");
      }

      if (logoFile && clubId) {
        const formData = new FormData();
        formData.append("logo", logoFile);
        await adminApi.uploadClubLogo(clubId, formData);
      }

      setIsModalOpen(false);
      queryClient.invalidateQueries("admin-clubs");
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        {handleApiError(error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Клубы</h1>
          <p className="mt-2 text-gray-600">
            {isClubAdmin
              ? "Создание и управление клубами"
              : "Редактирование своего клуба"}
          </p>
        </div>
        {isClubAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Создать клуб
          </button>
        )}
      </div>

      {clubs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          {isClubAdmin
            ? "Клубов пока нет. Создайте первый клуб."
            : "Клубов пока нет."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clubs.map((club) => {
            const showEdit = canEditClub(club);
            const showDelete = canDeleteClub(club);
            return (
            <div key={club.id} className="card p-5 flex flex-col">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gray-50 border flex items-center justify-center overflow-hidden shrink-0">
                  {club.logo_url ? (
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <BuildingLibraryIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-gray-900 truncate">
                    {club.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Состав: {(club.members ?? []).length}
                  </p>
                  {(club.owners ?? []).length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      Владельцы:{" "}
                      {(club.owners ?? []).map((o) => o.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              {(showEdit || showDelete) && (
              <div className="mt-4 flex gap-2 justify-end">
                {showEdit && (
                <button
                  type="button"
                  onClick={() => openEdit(club)}
                  className="btn-secondary inline-flex items-center text-sm"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Изменить
                </button>
                )}
                {showDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить клуб «${club.name}»? Игроки в базе останутся.`
                        )
                      ) {
                        deleteMutation.mutate(club.id);
                      }
                    }}
                    className="inline-flex items-center text-sm px-3 py-2 rounded-lg text-red-700 bg-red-50 hover:bg-red-100"
                    disabled={deleteMutation.isLoading}
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Удалить
                  </button>
                )}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingClub ? "Редактирование клуба" : "Новый клуб"}
            </h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название
                </label>
                <input
                  className="input-field w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Логотип
                </label>
                <div className="flex items-center gap-3">
                  {(editingClub?.logo_url || logoFile) && (
                    <div className="h-14 w-14 rounded-full border overflow-hidden bg-gray-50 flex items-center justify-center">
                      {logoFile ? (
                        <img
                          src={URL.createObjectURL(logoFile)}
                          alt="preview"
                          className="h-full w-full object-contain"
                        />
                      ) : editingClub?.logo_url ? (
                        <img
                          src={editingClub.logo_url}
                          alt={editingClub.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <PhotoIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) =>
                      setLogoFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>

              {isClubAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Владельцы (роль «Владелец клуба»)
                  </label>
                  {ownerCandidates.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Нет пользователей с ролью «Владелец клуба». Создайте
                      пользователя в разделе «Пользователи».
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                      {ownerCandidates.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={ownerIds.includes(u.id)}
                            onChange={() => toggleOwner(u.id)}
                          />
                          <span>
                            {u.name}{" "}
                            <span className="text-gray-400">({u.username})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Состав
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 min-w-0">
                    <PlayerAutocompleteField
                      label="Игрок"
                      value={memberPick}
                      onChange={setMemberPick}
                      excludeIds={members.map((m) => m.player_id)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary shrink-0 h-10 px-4"
                    onClick={() => addMember(memberPick)}
                    disabled={!memberPick}
                  >
                    Добавить
                  </button>
                </div>
                {members.length > 0 && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ФИО
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Дата добавления
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {" "}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {members.map((m) => (
                          <tr key={m.player_id}>
                            <td className="px-3 py-2 text-gray-900">
                              {m.player_name}
                              {m.city ? (
                                <span className="text-gray-400">
                                  {" "}
                                  · {m.city}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {m.created_at ? formatDate(m.created_at) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="text-red-600 hover:underline"
                                onClick={() => setMemberToRemove(m)}
                              >
                                Убрать
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setMemberToRemove(null);
                    setIsModalOpen(false);
                  }}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div
            className="card w-full max-w-md p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
          >
            <h3
              id="remove-member-title"
              className="text-lg font-semibold text-gray-900"
            >
              Удалить из состава?
            </h3>
            <p className="mt-3 text-sm text-gray-600">
              Убрать игрока{" "}
              <span className="font-medium text-gray-900">
                {memberToRemove.player_name}
              </span>{" "}
              из состава клуба? Изменения применятся после сохранения.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMemberToRemove(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700"
                onClick={confirmRemoveMember}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClubs;
