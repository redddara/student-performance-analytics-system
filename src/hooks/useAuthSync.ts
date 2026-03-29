import { useEffect } from 'react';
import { useStore } from '../store';

export const useAuthSync = () => {
  const initializeAuth = useStore((state) => state.initializeAuth);

  useEffect(() => {
    // Initial auth check
    initializeAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authTrigger_v1' && e.newValue && e.newValue !== e.oldValue) {
        initializeAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [initializeAuth]);
};
