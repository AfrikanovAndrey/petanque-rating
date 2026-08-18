import { pool } from "../config/database";
import {
  Club,
  ClubMemberInput,
  ClubMemberSummary,
  ClubOwnerSummary,
  ClubWithDetails,
  CreateClubRequest,
  UpdateClubRequest,
} from "../types";
import { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";

export class ClubModel {
  static toLogoUrl(logoPath: string | null | undefined): string | null {
    if (!logoPath) return null;
    return logoPath.startsWith("/") ? logoPath : `/${logoPath}`;
  }

  private static async getOwners(
    clubId: number,
    conn?: PoolConnection
  ): Promise<ClubOwnerSummary[]> {
    const db = conn ?? pool;
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT u.id AS user_id, u.name, u.username
       FROM club_owners co
       JOIN users u ON u.id = co.user_id
       WHERE co.club_id = ?
       ORDER BY u.name`,
      [clubId]
    );
    return rows as ClubOwnerSummary[];
  }

  private static async getMembers(
    clubId: number,
    conn?: PoolConnection
  ): Promise<ClubMemberSummary[]> {
    const db = conn ?? pool;
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT p.id AS player_id, p.name AS player_name, p.city, p.license_number,
              DATE_FORMAT(cm.joined_at, '%Y-%m-%d') AS joined_at,
              cm.created_at
       FROM club_members cm
       JOIN players p ON p.id = cm.player_id
       WHERE cm.club_id = ?
       ORDER BY p.name`,
      [clubId]
    );
    return rows as ClubMemberSummary[];
  }

  private static async attachDetails(
    club: Club,
    conn?: PoolConnection
  ): Promise<ClubWithDetails> {
    const [owners, members] = await Promise.all([
      ClubModel.getOwners(club.id, conn),
      ClubModel.getMembers(club.id, conn),
    ]);
    return {
      ...club,
      owners,
      members,
      logo_url: ClubModel.toLogoUrl(club.logo_path),
    };
  }

  static async getAllClubs(): Promise<ClubWithDetails[]> {
    const [rows] = await pool.execute<(Club & RowDataPacket)[]>(
      "SELECT * FROM clubs ORDER BY name"
    );
    return Promise.all(rows.map((row) => ClubModel.attachDetails(row)));
  }

  static async getClubsForOwner(userId: number): Promise<ClubWithDetails[]> {
    const [rows] = await pool.execute<(Club & RowDataPacket)[]>(
      `SELECT c.* FROM clubs c
       JOIN club_owners co ON co.club_id = c.id
       WHERE co.user_id = ?
       ORDER BY c.name`,
      [userId]
    );
    return Promise.all(rows.map((row) => ClubModel.attachDetails(row)));
  }

  static async getClubById(id: number): Promise<ClubWithDetails | null> {
    const [rows] = await pool.execute<(Club & RowDataPacket)[]>(
      "SELECT * FROM clubs WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return null;
    return ClubModel.attachDetails(rows[0]);
  }

  static async isOwner(clubId: number, userId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT 1 FROM club_owners WHERE club_id = ? AND user_id = ? LIMIT 1",
      [clubId, userId]
    );
    return rows.length > 0;
  }

  static async getClubIdForOwner(userId: number): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT club_id FROM club_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    return rows.length > 0 ? (rows[0].club_id as number) : null;
  }

  private static async assertOwnersAvailable(
    ownerUserIds: number[],
    clubId: number | null,
    conn: PoolConnection
  ): Promise<void> {
    if (ownerUserIds.length === 0) return;

    const placeholders = ownerUserIds.map(() => "?").join(",");
    const [users] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM users WHERE id IN (${placeholders})`,
      ownerUserIds
    );
    if (users.length !== ownerUserIds.length) {
      throw Object.assign(new Error("Один или несколько владельцев не найдены"), {
        statusCode: 400,
      });
    }

    const params: (number | null)[] = [...ownerUserIds];
    let excludeSql = "";
    if (clubId != null) {
      excludeSql = " AND club_id <> ?";
      params.push(clubId);
    }

    const [busy] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id, club_id FROM club_owners
       WHERE user_id IN (${placeholders})${excludeSql}`,
      params
    );
    if (busy.length > 0) {
      throw Object.assign(
        new Error(
          "Пользователь уже является владельцем другого клуба (один владелец — один клуб)"
        ),
        { statusCode: 409 }
      );
    }
  }

  private static async assertMembersAvailable(
    memberPlayerIds: number[],
    clubId: number | null,
    conn: PoolConnection
  ): Promise<void> {
    if (memberPlayerIds.length === 0) return;

    const placeholders = memberPlayerIds.map(() => "?").join(",");
    const [players] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM players WHERE id IN (${placeholders})`,
      memberPlayerIds
    );
    if (players.length !== memberPlayerIds.length) {
      throw Object.assign(new Error("Один или несколько игроков не найдены"), {
        statusCode: 400,
      });
    }

    const params: (number | null)[] = [...memberPlayerIds];
    let excludeSql = "";
    if (clubId != null) {
      excludeSql = " AND club_id <> ?";
      params.push(clubId);
    }

    const [busy] = await conn.execute<RowDataPacket[]>(
      `SELECT cm.player_id, p.name AS player_name, c.name AS club_name
       FROM club_members cm
       JOIN players p ON p.id = cm.player_id
       JOIN clubs c ON c.id = cm.club_id
       WHERE cm.player_id IN (${placeholders})${excludeSql}`,
      params
    );
    if (busy.length > 0) {
      const names = busy
        .map((r) => `${r.player_name} (клуб «${r.club_name}»)`)
        .join(", ");
      throw Object.assign(
        new Error(`Игрок уже состоит в другом клубе: ${names}`),
        { statusCode: 409 }
      );
    }
  }

  private static async replaceOwners(
    clubId: number,
    ownerUserIds: number[],
    conn: PoolConnection
  ): Promise<void> {
    await conn.execute("DELETE FROM club_owners WHERE club_id = ?", [clubId]);
    for (const userId of ownerUserIds) {
      await conn.execute(
        "INSERT INTO club_owners (club_id, user_id) VALUES (?, ?)",
        [clubId, userId]
      );
    }
  }

  static parseJoinedAt(value: unknown): string | undefined {
    if (value == null || value === "") return undefined;
    if (typeof value !== "string") {
      throw Object.assign(
        new Error("Дата вступления должна быть строкой в формате ГГГГ-ММ-ДД"),
        { statusCode: 400 }
      );
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
      throw Object.assign(
        new Error("Дата вступления должна быть в формате ГГГГ-ММ-ДД"),
        { statusCode: 400 }
      );
    }
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
      throw Object.assign(new Error("Некорректная дата вступления"), {
        statusCode: 400,
      });
    }
    return iso;
  }

  static resolveMembersFromRequest(
    data: CreateClubRequest | UpdateClubRequest
  ): ClubMemberInput[] | undefined {
    if (data.members !== undefined) {
      if (!Array.isArray(data.members)) {
        throw Object.assign(new Error("Список состава должен быть массивом"), {
          statusCode: 400,
        });
      }
      const seen = new Set<number>();
      const result: ClubMemberInput[] = [];
      for (const item of data.members) {
        const playerId = Number(item?.player_id);
        if (!Number.isInteger(playerId) || playerId <= 0) {
          throw Object.assign(new Error("Некорректный идентификатор игрока"), {
            statusCode: 400,
          });
        }
        if (seen.has(playerId)) continue;
        seen.add(playerId);
        result.push({
          player_id: playerId,
          joined_at: ClubModel.parseJoinedAt(item?.joined_at),
        });
      }
      return result;
    }
    if (data.member_player_ids !== undefined) {
      return [...new Set(data.member_player_ids)].map((player_id) => ({
        player_id,
      }));
    }
    return undefined;
  }

  /**
   * Синхронизирует состав: удаляет исключённых, добавляет новых,
   * сохраняет дату вступления у оставшихся (если её не меняют).
   */
  private static async replaceMembers(
    clubId: number,
    members: ClubMemberInput[],
    conn: PoolConnection,
    options: { allowJoinedAtUpdate: boolean }
  ): Promise<void> {
    const [existing] = await conn.execute<RowDataPacket[]>(
      `SELECT player_id, DATE_FORMAT(joined_at, '%Y-%m-%d') AS joined_at
       FROM club_members WHERE club_id = ?`,
      [clubId]
    );
    const existingByPlayer = new Map<number, string>(
      existing.map((row) => [row.player_id as number, String(row.joined_at)])
    );
    const nextIds = new Set(members.map((m) => m.player_id));

    for (const row of existing) {
      const playerId = row.player_id as number;
      if (!nextIds.has(playerId)) {
        await conn.execute(
          "DELETE FROM club_members WHERE club_id = ? AND player_id = ?",
          [clubId, playerId]
        );
      }
    }

    for (const member of members) {
      const previous = existingByPlayer.get(member.player_id);
      const nextJoinedAt =
        options.allowJoinedAtUpdate && member.joined_at
          ? member.joined_at
          : undefined;

      if (previous === undefined) {
        await conn.execute(
          "INSERT INTO club_members (club_id, player_id, joined_at) VALUES (?, ?, COALESCE(?, CURRENT_DATE))",
          [clubId, member.player_id, nextJoinedAt ?? null]
        );
      } else if (nextJoinedAt && nextJoinedAt !== previous) {
        await conn.execute(
          "UPDATE club_members SET joined_at = ? WHERE club_id = ? AND player_id = ?",
          [nextJoinedAt, clubId, member.player_id]
        );
      }
    }
  }

  static async createClub(
    data: CreateClubRequest,
    options: { allowJoinedAtUpdate: boolean } = { allowJoinedAtUpdate: false }
  ): Promise<ClubWithDetails> {
    const name = data.name.trim();
    if (!name) {
      throw Object.assign(new Error("Название клуба обязательно"), {
        statusCode: 400,
      });
    }

    const ownerUserIds = [...new Set(data.owner_user_ids ?? [])];
    const members = ClubModel.resolveMembersFromRequest(data) ?? [];
    const memberPlayerIds = members.map((m) => m.player_id);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await ClubModel.assertOwnersAvailable(ownerUserIds, null, conn);
      await ClubModel.assertMembersAvailable(memberPlayerIds, null, conn);

      const [result] = await conn.execute<ResultSetHeader>(
        "INSERT INTO clubs (name) VALUES (?)",
        [name]
      );
      const clubId = result.insertId;

      await ClubModel.replaceOwners(clubId, ownerUserIds, conn);
      await ClubModel.replaceMembers(clubId, members, conn, {
        allowJoinedAtUpdate: options.allowJoinedAtUpdate,
      });

      await conn.commit();
      const club = await ClubModel.getClubById(clubId);
      if (!club) {
        throw new Error("Клуб не найден после создания");
      }
      return club;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async updateClub(
    id: number,
    data: UpdateClubRequest,
    options: { allowOwnersUpdate: boolean; allowJoinedAtUpdate: boolean }
  ): Promise<ClubWithDetails | null> {
    const existing = await ClubModel.getClubById(id);
    if (!existing) return null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (data.name !== undefined) {
        const name = data.name.trim();
        if (!name) {
          throw Object.assign(new Error("Название клуба обязательно"), {
            statusCode: 400,
          });
        }
        await conn.execute("UPDATE clubs SET name = ? WHERE id = ?", [
          name,
          id,
        ]);
      }

      if (options.allowOwnersUpdate && data.owner_user_ids !== undefined) {
        const ownerUserIds = [...new Set(data.owner_user_ids)];
        await ClubModel.assertOwnersAvailable(ownerUserIds, id, conn);
        await ClubModel.replaceOwners(id, ownerUserIds, conn);
      }

      const members = ClubModel.resolveMembersFromRequest(data);
      if (members !== undefined) {
        const memberPlayerIds = members.map((m) => m.player_id);
        await ClubModel.assertMembersAvailable(memberPlayerIds, id, conn);
        await ClubModel.replaceMembers(id, members, conn, {
          allowJoinedAtUpdate: options.allowJoinedAtUpdate,
        });
      }

      await conn.commit();
      return ClubModel.getClubById(id);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async updateLogoPath(
    id: number,
    logoPath: string | null
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE clubs SET logo_path = ? WHERE id = ?",
      [logoPath, id]
    );
    return result.affectedRows > 0;
  }

  static async deleteClub(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM clubs WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }
}
