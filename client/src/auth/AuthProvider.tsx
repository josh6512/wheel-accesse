import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { authenticate, getAuthState, logout, restoreSession, subscribeAuth } from './authSession';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(subscribeAuth, getAuthState);
  useEffect(() => {
    void restoreSession();
  }, []);
  return (
    <AuthContext.Provider value={{ ...state, authenticate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
