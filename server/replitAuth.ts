// Replit authentication completely disabled
// This file is kept for compatibility but all functions are no-ops
import type { Express, RequestHandler } from "express";

// No-op functions to disable Replit authentication entirely
export function getSession() {
  return null;
}

export async function setupAuth(app: Express) {
  // Do nothing - Replit auth disabled
  console.log("Replit authentication disabled - using local authentication only");
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // This should never be called when using local auth
  return res.status(401).json({ message: "Replit auth disabled - use local auth" });
};