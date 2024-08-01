// AuthContext.js
'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import * as dataProvider from '../lib/dataProvider';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const localSession = JSON.parse(localStorage.getItem('session'));
      if (localSession) {
        setSession(localSession);
        const userData = await dataProvider.fetchUserDetails(localSession.user.id);
        if (userData) {
          console.log("WHAT:",userData.role);
          if (userData.role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      }
    };

    getSession();

    if (!process.env.NEXT_PUBLIC_USE_LOCAL) {
      const { data: authListener } = dataProvider.supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
          if (session) {
            const { user } = session;
            dataProvider.fetchUserByEmail(user.email).then(({ data: userData, error }) => {
              if (!error && userData.role === 'admin') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            });
          } else {
            setIsAdmin(false);
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const login = (user) => {
    setSession({ user });
    setIsAdmin(user.role === 'admin');
    if (process.env.NEXT_PUBLIC_USE_LOCAL) {
      localStorage.setItem('session', JSON.stringify({ user }));
    }
  };

  const logout = async () => {
    if (process.env.NEXT_PUBLIC_USE_LOCAL) {
      localStorage.removeItem('session');
    } else {
      await dataProvider.supabase.auth.signOut();
    }
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
