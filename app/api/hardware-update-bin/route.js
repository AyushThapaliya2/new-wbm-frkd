import { updateDevice, insertNewDevice, saveToHistorical, getDeviceById } from '@/lib/dataProvider';

export const POST = async (req) => {
  const body = await req.json();
  const { token, unique_id, battery, level, reception, temp, humidity } = body;
  const secretToken = process.env.SECRET_TOKEN;

  if (token !== secretToken) {
    return new Response(JSON.stringify({ status: 0, msg: 'Unauthorized request: TOKEN INVALID' }), { status: 403 });
  }

  if (!unique_id) {
    return new Response(JSON.stringify({ status: 0, msg: 'Invalid input: unique_id is required' }), { status: 400 });
  }

  const updateFields = {};
  if (battery !== undefined) updateFields.battery = battery;
  if (level !== undefined) updateFields.level = level;
  if (reception !== undefined) updateFields.reception = reception;
  if (temp !== undefined) updateFields.temp = temp;
  if (humidity !== undefined) updateFields.humidity = humidity;
  updateFields.timestamp = new Date();

  if (Object.keys(updateFields).length === 0) {
    return new Response(JSON.stringify({ status: 0, msg: 'No valid fields provided for update' }), { status: 400 });
  }

  try {
    let deviceData;
    try {
      deviceData = await getDeviceById(unique_id);
    } catch (error) {
      if (error.message === 'Device not found') {
        deviceData = null;
      } else {
        throw error;
      }
    }

    if (!deviceData) {
      const newDeviceData = await insertNewDevice({
        unique_id: unique_id,
        battery: battery,
        level: level,
        reception: reception,
        timestamp: new Date(),
        is_registered: false,
        temp: temp,
        humidity: humidity
      });

      return new Response(JSON.stringify({ status: 1, msg: 'New device inserted with is_registered set to false', data: newDeviceData }), { status: 200 });
    }

    const binHeight = deviceData.bin_height;
    const trashHeight = binHeight - level;
    const level_in_percents = parseInt((trashHeight * 100) / binHeight);

    const updateData = await updateDevice(unique_id, updateFields);

    if (deviceData.is_registered) {
      await saveToHistorical({
        unique_id: unique_id,
        level_in_percents: level_in_percents,
        saved_time: new Date(),
      });
    }

    return new Response(JSON.stringify({ status: 1, msg: 'Device information updated and saved to historical', data: updateData }), { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error.message);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};
