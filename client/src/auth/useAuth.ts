import { createContext, useContext } from 'react';
import { authenticate, getAuthState, logout } from './authSession';

export const AuthContext = createContext({ ...getAuthState(), authenticate, logout });
export const useAuth = () => useContext(AuthContext);
