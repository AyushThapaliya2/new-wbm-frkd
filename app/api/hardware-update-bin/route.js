import { supabase } from '@/lib/supabaseClient';

export const POST = async (req) => {
  const body = await req.json();
  const { deviceID, battery, level, reception, authToken } = body;

  // Replace with your actual secret token
  const SECRET_TOKEN = process.env.SECRET_TOKEN || 'your-secret-token';

  if (authToken !== SECRET_TOKEN) {
    return new Response(JSON.stringify({ status: 0, msg: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { data: foundDevices, error: findError } = await supabase
      .from('devices')
      .select('*')
      .eq('unique_id', deviceID);

    if (findError) {
      throw findError;
    }

    if (!foundDevices.length) {
      const { data: insertData, error: insertError } = await supabase
        .from('devices')
        .insert({
          unique_id: deviceID,
          battery,
          level,
          reception,
          is_registered: false,
        });

      if (insertError) {
        throw insertError;
      }

      return new Response(JSON.stringify({ status: 1, msg: 'Inserted into the database', data: insertData }), { status: 200 });
    } else {
      const { data: updateData, error: updateError } = await supabase
        .from('devices')
        .update({
          battery,
          level,
          reception,
          timestamp: new Date(),
        })
        .eq('unique_id', deviceID)
        .single();

      if (updateError) {
        throw updateError;
      }

      const distanceInCM = updateData.level;
      const binHeight = updateData.bin_height;
      const trashHeight = binHeight - distanceInCM;
      const level_in_percents = parseInt((trashHeight * 100) / binHeight);

      const { data: historicalData, error: historicalError } = await supabase
        .from('historical')
        .insert({
          unique_id: updateData.unique_id,
          level_in_percents,
          saved_time: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        });

      if (historicalError) {
        throw historicalError;
      }

      return new Response(JSON.stringify({ status: 1, msg: 'Updated the database', data: updateData, historicalData }), { status: 200 });
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};
