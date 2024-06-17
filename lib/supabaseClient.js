import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Function to fetch user details
export const fetchUserDetails = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('fname, lname')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
  return data;
};

// Function to fetch devices
export const fetchDevices = async () => {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('is_registered', true);
  if (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
  return data;
};

// Function to fetch feedbacks
export const fetchFeedbacks = async () => {
  const { data, error } = await supabase.from('feedbacks').select('*');
  if (error) {
    console.error('Error fetching feedbacks:', error);
    return [];
  }
  return data;
};

// Function to add feedback
export const addFeedback = async (feedback) => {
  const { data, error } = await supabase.from('feedbacks').insert([feedback]);
  return { data, error };
};


// Function to fetch historical data
export const fetchHistoricalData = async () => {
    const { data, error } = await supabase.from('historical').select('*');
    if (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
    return data;
  };
  
  // Function to clear historical data
  export const clearHistoricalData = async () => {
    const { error } = await supabase.from('historical').delete().neq('id', 0);
    if (error) {
      console.error('Error clearing historical data:', error);
      return false;
    }
    return true;
  };
  