'use client';

import { useState, useEffect } from 'react';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface UserInfo {
  nama: string;
  role: 'admin' | 'pegawai';  // backward-compat
  roles: string[];             // multi-role: ['warehouse','logistik','sales',...]
  pegawaiId: string;
}

export function useUser(): UserInfo {
  const [user, setUser] = useState<UserInfo>({ nama: 'Pengguna', role: 'admin', roles: ['admin'], pegawaiId: '' });

  useEffect(() => {
    const cookieName = getCookie('user_name');
    const cookieRole = getCookie('user_role') as 'admin' | 'pegawai' | null;
    const cookieRoles = getCookie('user_roles'); // comma-separated
    const cookiePegawaiId = getCookie('user_pegawai_id');

    if (cookieName && cookieRole) {
      const list = cookieRoles ? cookieRoles.split(',').filter(Boolean) : [cookieRole];
      // Jaga-jaga: kalau role utama admin, pastikan 'admin' ada di daftar (cookie lama kadang ketinggalan)
      if (cookieRole === 'admin' && !list.includes('admin')) list.unshift('admin');
      setUser({
        nama: cookieName,
        role: cookieRole,
        roles: list,
        pegawaiId: cookiePegawaiId || '',
      });
      return;
    }

    fetch('/api/profil')
      .then((r) => r.json())
      .then((data) => {
        if (data?.nama) {
          setUser(prev => ({ ...prev, nama: data.nama }));
        }
      })
      .catch(() => {});
  }, []);

  return user;
}

/** Helper: cek apakah user punya salah satu role */
export function hasRole(user: UserInfo, ...roles: string[]): boolean {
  if (user.roles.includes('admin')) return true; // admin selalu bisa semua
  return roles.some(r => user.roles.includes(r));
}
