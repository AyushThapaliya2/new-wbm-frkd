import { supabase } from '@/lib/supabaseClient';

export const POST = async (req) => {
  const body = await req.json();
  const { token, unique_id, battery, reception, temperature, humidity } = body;
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
  if (reception !== undefined) updateFields.reception = reception;
  if (temperature !== undefined) updateFields.temperature = temperature;
  if (humidity !== undefined) updateFields.humidity = humidity;
  updateFields.timestamp = new Date();

  if (Object.keys(updateFields).length === 0) {
    return new Response(JSON.stringify({ status: 0, msg: 'No valid fields provided for update' }), { status: 400 });
  }

  try {
    const { data: deviceData, error: deviceError } = await supabase
      .from('weather_sensors')
      .select('is_registered')
      .eq('unique_id', unique_id)
      .maybeSingle(); // Use maybeSingle() to avoid throwing an error

    if (deviceError) {
      throw deviceError;
    }

    if (!deviceData) {
      // Insert new device with is_registered set to false
      const { data: newDeviceData, error: newDeviceError } = await supabase
        .from('weather_sensors')
        .insert({ 
          unique_id: unique_id,
          battery: battery,
          reception: reception,
          timestamp: new Date(),
          is_registered: false,
          temperature: temperature,
          humidity: humidity
        })
        .select() // Use select() to return the inserted row
        .single();

      if (newDeviceError) {
        throw newDeviceError;
      }

      return new Response(JSON.stringify({ status: 1, msg: 'New weather sensor inserted with is_registered set to false', data: newDeviceData }), { status: 200 });
    }

    // Proceed with updating the existing device
    const { data: updateData, error: updateError } = await supabase
      .from('weather_sensors')
      .update(updateFields)
      .eq('unique_id', unique_id)
      .select() // Use select() to return the updated row
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ status: 1, msg: 'Weather sensor information updated', data: updateData }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};
