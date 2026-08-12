'use client';

import { useCallback } from 'react';
import { useUser } from '@/app/hooks/useUser';

export function useRole() {
  const { role, roles } = useUser();

  const isAdmin = role === 'admin';

  const canAccess = useCallback((module: string): boolean => {
    if (isAdmin) return true;
    if (!roles || roles.length === 0) return false;
    return roles.includes(module) || roles.includes('admin');
  }, [isAdmin, roles]);

  return {
    role,
    roles: roles || [],
    isAdmin,
    canAccess,
  };
}
