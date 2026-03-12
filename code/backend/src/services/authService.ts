import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import type { User } from '../models/types';

const JWT_SECRET = process.env.JWT_SECRET || 'router-app-secret-change-in-production';
const JWT_EXPIRES = '7d';

export interface AuthTokenPayload {
  userId: number;
  email: string;
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  displayName?: string
): Promise<{ user: User; token: string }> {
  // Check existing
  const { rows: existing } = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.length > 0) throw new Error('כתובת האימייל כבר רשומה במערכת');

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await db.query(
    `INSERT INTO users (email, full_name, display_name, password_hash, xp_points, level)
     VALUES ($1, $2, $3, $4, 0, 'מטייל מתחיל')
     RETURNING *`,
    [email, fullName, displayName || fullName, passwordHash]
  );
  const user = rows[0] as User;
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user, token };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const { rows } = await db.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email]);
  if (!rows.length) throw new Error('אימייל או סיסמה שגויים');

  const user = rows[0] as User & { password_hash: string };
  if (!user.password_hash) throw new Error('אימייל או סיסמה שגויים');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('אימייל או סיסמה שגויים');

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user, token };
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await db.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows.length ? (rows[0] as User) : null;
}
