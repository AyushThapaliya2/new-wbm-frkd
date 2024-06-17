import { supabase } from '@/lib/supabaseClient';

export const POST = async (req) => {
  const body = await req.json();
  const { token, unique_id, battery, level, reception } = body;
  const secretToken = process.env.SECRET_TOKEN;
  
  if (token !== secretToken) {
    return new Response(JSON.stringify({ status: 0, msg: 'Unauthorized request: TOKEN INVALID' }), { status: 403 });
  }

  if (!unique_id) {
    return new Response(JSON.stringify({ status: 0, msg: 'Invalid input: unique_id is required' }), { status: 400 });
  }

  // Construct the update object dynamically
  const updateFields = {};
  if (battery !== undefined) updateFields.battery = battery;
  if (level !== undefined) updateFields.level = level;
  if (reception !== undefined) updateFields.reception = reception;
  updateFields.timestamp = new Date();

  if (Object.keys(updateFields).length === 0) {
    return new Response(JSON.stringify({ status: 0, msg: 'No valid fields provided for update' }), { status: 400 });
  }

  try {
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('bin_height, is_registered')
      .eq('unique_id', unique_id)
      .maybeSingle(); // Use maybeSingle() to avoid throwing an error

    if (deviceError) {
      throw deviceError;
    }

    if (!deviceData) {
      // Insert new device with is_registered set to false
      const { data: newDeviceData, error: newDeviceError } = await supabase
        .from('devices')
        .insert({ 
          unique_id: unique_id,
          battery: battery,
          level: level,
          reception: reception,
          timestamp: new Date(),
          is_registered: false 
        })
        .select() // Use select() to return the inserted row
        .single();

      if (newDeviceError) {
        throw newDeviceError;
      }

      return new Response(JSON.stringify({ status: 1, msg: 'New device inserted with is_registered set to false', data: newDeviceData }), { status: 200 });
    }

    // Proceed with updating the existing device
    const binHeight = deviceData.bin_height;
    const trashHeight = binHeight - level;
    const level_in_percents = parseInt((trashHeight * 100) / binHeight);

    const { data: updateData, error: updateError } = await supabase
      .from('devices')
      .update(updateFields)
      .eq('unique_id', unique_id)
      .select() // Use select() to return the updated row
      .single();

    if (updateError) {
      throw updateError;
    }

    // Save to historical table if the device is registered
    if (deviceData.is_registered) {
      const { data: historicalData, error: historicalError } = await supabase
        .from('historical')
        .insert({
          unique_id: unique_id,
          level_in_percents: level_in_percents,
          saved_time: new Date(),
        })
        .select() // Use select() to return the inserted row
        .single();

      if (historicalError) {
        throw historicalError;
      }
    }

    return new Response(JSON.stringify({ status: 1, msg: 'Device information updated and saved to historical', data: updateData }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};
