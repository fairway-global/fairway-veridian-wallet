import { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200
): Response {
  return res.status(status).json({
    success: true,
    data,
    error: null,
  });
}

export function sendError(
  res: Response,
  status: number,
  error: string,
  data: unknown = null
): Response {
  return res.status(status).json({
    success: false,
    data,
    error,
  });
}
