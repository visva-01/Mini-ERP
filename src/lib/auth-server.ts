import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { query } from "./db";
import { hashPassword, verifyPassword } from "./auth-crypto";

export interface User {
  id: number;
  username: string;
  role: string;
}

/**
 * Returns the current authenticated user or null.
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async (): Promise<User | null> => {
    const username = getCookie("session_user");
    if (!username) return null;

    try {
      const result = await query(
        "SELECT id, username, role FROM users WHERE username = $1",
        [username]
      );
      if (result.rows.length === 0) return null;
      return result.rows[0] as User;
    } catch (e) {
      console.error("Error fetching current user:", e);
      return null;
    }
  });

/**
 * Authenticates a user and sets a session cookie.
 */
export const loginUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().min(1, "Username is required"),
      password: z.string().min(1, "Password is required"),
    })
  )
  .handler(async ({ data }) => {
    const { username, password } = data;

    try {
      const result = await query(
        "SELECT id, username, password_hash, role FROM users WHERE username = $1",
        [username]
      );

      if (result.rows.length === 0) {
        throw new Error("Invalid username or password.");
      }

      const user = result.rows[0];
      const isValid = verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new Error("Invalid username or password.");
      }

      setCookie("session_user", username, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
      });

      return { id: user.id, username: user.username, role: user.role } as User;
    } catch (error: any) {
      throw new Error(error.message || "Failed to log in.");
    }
  });

/**
 * Registers a new user and sets a session cookie.
 */
export const signupUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().min(1, "Username must be at least 1 character"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      role: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { username, password, role = "operator" } = data;

    try {
      // Check if user already exists
      const checkResult = await query(
        "SELECT 1 FROM users WHERE username = $1",
        [username]
      );

      if (checkResult.rows.length > 0) {
        throw new Error("Username already taken.");
      }

      const passwordHash = hashPassword(password);
      const result = await query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
        [username, passwordHash, role]
      );

      const newUser = result.rows[0];

      setCookie("session_user", username, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
      });

      return newUser as User;
    } catch (error: any) {
      throw new Error(error.message || "Failed to sign up.");
    }
  });

/**
 * Logs out the user by clearing the session cookie.
 */
export const logoutUser = createServerFn({ method: "POST" })
  .handler(async () => {
    deleteCookie("session_user");
    return { success: true };
  });
