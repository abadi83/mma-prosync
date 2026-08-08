import { NextResponse } from 'next/server';

/**
 * Helper untuk response sukses & error yang konsisten di seluruh API.
 */

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function apiBadRequest(message: string) {
  return apiError(message, 400);
}

export function apiNotFound(message = 'Data tidak ditemukan') {
  return apiError(message, 404);
}

export function apiServerError(context: string) {
  console.error(`[API Error] ${context}`);
  return apiError('Terjadi kesalahan pada server', 500);
}
