import { pool } from "../config/database";
import {
  Club,
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

  private static async replaceMembers(
    clubId: number,
    memberPlayerIds: number[],
    conn: PoolConnection
  ): Promise<void> {
    await conn.execute("DELETE FROM club_members WHERE club_id = ?", [clubId]);
    for (const playerId of memberPlayerIds) {
      await conn.execute(
        "INSERT INTO club_members (club_id, player_id) VALUES (?, ?)",
        [clubId, playerId]
      );
    }
  }

  static async createClub(data: CreateClubRequest): Promise<ClubWithDetails> {
    const name = data.name.trim();
    if (!name) {
      throw Object.assign(new Error("Название клуба обязательно"), {
        statusCode: 400,
      });
    }

    const ownerUserIds = [...new Set(data.owner_user_ids ?? [])];
    const memberPlayerIds = [...new Set(data.member_player_ids ?? [])];

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
      await ClubModel.replaceMembers(clubId, memberPlayerIds, conn);

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
    options: { allowOwnersUpdate: boolean }
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

      if (data.member_player_ids !== undefined) {
        const memberPlayerIds = [...new Set(data.member_player_ids)];
        await ClubModel.assertMembersAvailable(memberPlayerIds, id, conn);
        await ClubModel.replaceMembers(id, memberPlayerIds, conn);
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
