// lib/realtimeSubscription.js

import { supabase } from './supabaseClient';

export const subscribeToTableChanges = (table, callback) => {
  const subscription = supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      callback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};
