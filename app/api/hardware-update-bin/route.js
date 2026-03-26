import {
  updateDeviceHardware,
  insertNewDevice,
  saveToHistorical,
  getDeviceById,
} from "@/lib/dataProvider";

export const POST = async (req) => {
  const body = await req.json();
  const {
    token,
    unique_id,
    battery,
    level,
    reception,
    temp,
    humidity,
    // new optional fields — passed through to device only
    bin_height,
    h2s: h2sRaw,
    smoke: smokeRaw,
    nh3: nh3Raw,
    // backwards-compatible aliases
    h2s_ppm: h2sPpmRaw,
    smoke_ppm: smokePpmRaw,
    nh3_ppm: nh3PpmRaw,
  } = body;

  const h2s = h2sRaw ?? h2sPpmRaw;
  const smoke = smokeRaw ?? smokePpmRaw;
  const nh3 = nh3Raw ?? nh3PpmRaw;

  const secretToken = process.env.SECRET_TOKEN;

  if (token !== secretToken) {
    return new Response(
      JSON.stringify({ status: 0, msg: "Unauthorized request: TOKEN INVALID" }),
      { status: 403 },
    );
  }

  if (!unique_id) {
    return new Response(
      JSON.stringify({
        status: 0,
        msg: "Invalid input: unique_id is required",
      }),
      { status: 400 },
    );
  }

  const updateFields = {};
  if (battery !== undefined) updateFields.battery = battery;
  if (level !== undefined) updateFields.level = level;
  if (reception !== undefined) updateFields.reception = reception;
  if (temp !== undefined) updateFields.temp = temp;
  if (humidity !== undefined) updateFields.humidity = humidity;

  // allow updating these on the device record, but they don't affect original logic
  if (bin_height !== undefined) updateFields.bin_height = bin_height;
  if (h2s !== undefined) updateFields.h2s = h2s;
  if (smoke !== undefined) updateFields.smoke = smoke;
  if (nh3 !== undefined) updateFields.nh3 = nh3;

  // check BEFORE adding timestamp (so timestamp-only doesn't pass)
  if (Object.keys(updateFields).length === 0) {
    return new Response(
      JSON.stringify({ status: 0, msg: "No valid fields provided for update" }),
      { status: 400 },
    );
  }

  updateFields.timestamp = new Date();

  try {
    let deviceData;
    try {
      deviceData = await getDeviceById(unique_id);
    } catch (error) {
      if (error.message === "Device not found") {
        deviceData = null;
      } else {
        throw error;
      }
    }

    if (!deviceData) {
      const newDeviceData = await insertNewDevice({
        unique_id,
        battery,
        level,
        reception,
        timestamp: new Date(),
        is_registered: false,
        temp,
        humidity,
        // store extras on first sight too (doesn't change core behavior)
        bin_height,
        h2s,
        smoke,
        nh3,
      });

      return new Response(
        JSON.stringify({
          status: 1,
          msg: "New device inserted with is_registered set to false",
          data: newDeviceData,
        }),
        { status: 200 },
      );
    }

    // Bin geometry for this hardware:
    // - database bin_height stays at 100 cm
    // - fillable trash depth is 70 cm
    // - top buffer from sensor to trash start is 30 cm
    const totalSensorToBottom = Number(deviceData.bin_height);
    const fillableDepth = 70;
    const measuredDistance = Number(level);
    const trashHeight = totalSensorToBottom - measuredDistance;

    let level_in_percents = Math.round((trashHeight * 100) / fillableDepth);
    level_in_percents = Math.max(0, Math.min(100, level_in_percents));

    const updateData = await updateDeviceHardware(unique_id, updateFields);

    // ORIGINAL historical behavior: only for registered devices,
    // and only level_in_percents (+ temp/humidity if provided)
    if (deviceData.is_registered) {
      const historicalData = {
        unique_id,
        level_in_percents,
        saved_time: new Date(),
      };
      if (temp !== undefined) historicalData.temp = temp;
      if (humidity !== undefined) historicalData.humidity = humidity;

      if (h2s !== undefined) historicalData.h2s = h2s;
      if (smoke !== undefined) historicalData.smoke = smoke;
      if (nh3 !== undefined) historicalData.nh3 = nh3;

      await saveToHistorical(historicalData);
    }

    return new Response(
      JSON.stringify({
        status: 1,
        msg: "Device information updated and saved to historical",
        data: updateData,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing request:", error.message);
    return new Response(
      JSON.stringify({
        status: 0,
        msg: "Internal Server Error",
        error: error.message,
      }),
      { status: 500 },
    );
  }
};
