import {
  updateDeviceHardware,
  insertNewDevice,
  saveToHistorical,
  getDeviceById,
} from "@/lib/dataProvider";

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null);

const pickTtnEvent = (body) => {
  if (body?.uplink_message) return body;
  if (body?.up?.uplink_message) return body.up;
  if (body?.result?.uplink_message) return body.result;
  return body;
};

const isValidNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue);
};

const parseIntegerCandidate = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseHexToInteger = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null;
  const parsed = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const resolveUniqueId = (decodedPayload, deviceIds) =>
  firstDefined(
    parseIntegerCandidate(decodedPayload.unique_id),
    parseIntegerCandidate(decodedPayload.device_id),
    parseIntegerCandidate(deviceIds.device_id),
    parseHexToInteger(deviceIds.dev_addr)
  );

export const POST = async (req) => {
  try {
    const body = await req.json();
    const event = pickTtnEvent(body);

    // Optional webhook secret validation. Set TTN_WEBHOOK_SECRET in env
    // and send the same value via TTN custom header (for example x-webhook-token).
    const requiredSecret = process.env.TTN_WEBHOOK_SECRET;
    if (requiredSecret) {
      const headerSecret =
        req.headers.get("x-webhook-token") ||
        req.headers.get("x-ttn-webhook-secret");
      const authHeader = req.headers.get("authorization");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

      if (headerSecret !== requiredSecret && bearerToken !== requiredSecret) {
        return new Response(
          JSON.stringify({ status: 0, msg: "Unauthorized webhook request" }),
          { status: 403 }
        );
      }
    }

    const decodedPayload = event?.uplink_message?.decoded_payload || {};
    const deviceIds = event?.end_device_ids || {};

    const unique_id = resolveUniqueId(decodedPayload, deviceIds);

    if (!unique_id) {
      return new Response(
        JSON.stringify({
          status: 0,
          msg: "Invalid TTN payload: provide numeric unique_id in decoded_payload or a valid dev_addr",
        }),
        { status: 400 }
      );
    }

    const battery = firstDefined(decodedPayload.battery, decodedPayload.batt);
    const level = firstDefined(decodedPayload.level, decodedPayload.distance);
    const reception = firstDefined(
      decodedPayload.reception,
      event?.uplink_message?.rx_metadata?.[0]?.rssi
    );
    const temp = firstDefined(decodedPayload.temp, decodedPayload.temperature);
    const humidity = decodedPayload.humidity;
    const bin_height = decodedPayload.bin_height;
    const h2s = firstDefined(decodedPayload.h2s, decodedPayload.h2s_ppm);
    const smoke = firstDefined(decodedPayload.smoke, decodedPayload.smoke_ppm);
    const nh3 = firstDefined(decodedPayload.nh3, decodedPayload.nh3_ppm);

    const updateFields = {};
    if (battery !== undefined) updateFields.battery = battery;
    if (level !== undefined) updateFields.level = level;
    if (reception !== undefined) updateFields.reception = reception;
    if (temp !== undefined) updateFields.temp = temp;
    if (humidity !== undefined) updateFields.humidity = humidity;
    if (bin_height !== undefined) updateFields.bin_height = bin_height;
    if (h2s !== undefined) updateFields.h2s = h2s;
    if (smoke !== undefined) updateFields.smoke = smoke;
    if (nh3 !== undefined) updateFields.nh3 = nh3;

    if (Object.keys(updateFields).length === 0) {
      return new Response(
        JSON.stringify({
          status: 0,
          msg: "No supported fields found in decoded_payload",
        }),
        { status: 400 }
      );
    }

    updateFields.timestamp = new Date();

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
        ...updateFields,
        is_registered: false,
      });

      return new Response(
        JSON.stringify({
          status: 1,
          msg: "TTN uplink received; new device inserted as unregistered",
          data: newDeviceData,
        }),
        { status: 200 }
      );
    }

    const updateData = await updateDeviceHardware(unique_id, updateFields);

    if (
      deviceData.is_registered &&
      level !== undefined &&
      isValidNumber(level) &&
      isValidNumber(deviceData.bin_height) &&
      Number(deviceData.bin_height) !== 0
    ) {
      const binHeight = Number(deviceData.bin_height);
      const trashHeight = binHeight - Number(level);
      const level_in_percents = parseInt((trashHeight * 100) / binHeight, 10);

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
        msg: "TTN uplink processed",
        data: updateData,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing TTN webhook:", error.message);
    return new Response(
      JSON.stringify({
        status: 0,
        msg: "Internal Server Error",
        error: error.message,
      }),
      { status: 500 }
    );
  }
};
