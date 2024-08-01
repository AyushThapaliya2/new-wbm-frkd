import { updateWeatherDevice, insertNewWeatherDevice, getWeatherDeviceById } from '@/lib/dataProvider';

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
    let deviceData;
    try {
      deviceData = await getWeatherDeviceById(unique_id);
    } catch (error) {
      if (error.message === 'Weather device not found') {
        deviceData = null;
      } else {
        throw error;
      }
    }

    if (!deviceData) {
      // Insert new device with is_registered set to false
      const newDeviceData = await insertNewWeatherDevice({
        unique_id,
        battery,
        reception,
        timestamp: new Date(),
        is_registered: false,
        temperature,
        humidity
      });

      return new Response(JSON.stringify({ status: 1, msg: 'New weather sensor inserted with is_registered set to false', data: newDeviceData }), { status: 200 });
    }

    // Proceed with updating the existing device
    const updateData = await updateWeatherDevice(unique_id, updateFields);

    return new Response(JSON.stringify({ status: 1, msg: 'Weather sensor information updated', data: updateData }), { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error.message);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};
