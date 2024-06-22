'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { user } = session;
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!error && userData.role === 'admin') {
          setIsAdmin(true);
        }
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          const { user } = session;
          const { data: userData, error } = supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
            .then(({ data: userData, error }) => {
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
  }, []);

  const login = (user) => {
    setSession({ user });
    setIsAdmin(user.role === 'admin');
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
