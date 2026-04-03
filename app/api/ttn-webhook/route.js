import {
  updateDeviceHardware,
  insertNewDevice,
  saveToHistorical,
  getDeviceById,
  updateWeatherDevice,
  insertNewWeatherDevice,
  getWeatherDeviceById,
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

const parseNumberCandidate = (value) => {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parseIntegerCandidate = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const hashStableIdentifier = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash === 0 ? 1 : hash;
};

const parseHexToInteger = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null;
  const parsed = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const buildUniqueIdCandidates = (decodedPayload, deviceIds, body) =>
  [
    parseIntegerCandidate(decodedPayload.unique_id),
    parseIntegerCandidate(decodedPayload.device_id),
    parseIntegerCandidate(body?.unique_id),
    parseIntegerCandidate(body?.device_id),
    parseIntegerCandidate(deviceIds.device_id),
    parseHexToInteger(deviceIds.dev_addr),
    hashStableIdentifier(deviceIds.dev_eui),
    hashStableIdentifier(deviceIds.device_id),
  ].filter((value, index, values) =>
    value !== null && value !== undefined && values.indexOf(value) === index,
  );

const findExistingUniqueId = async (candidates, fetcher) => {
  for (const candidate of candidates) {
    try {
      const record = await fetcher(candidate);
      if (record) return candidate;
    } catch (error) {
      if (
        error.message !== "Device not found" &&
        error.message !== "Weather device not found"
      ) {
        throw error;
      }
    }
  }

  return null;
};

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
          { status: 403 },
        );
      }
    }

    const decodedPayload =
      event?.uplink_message?.decoded_payload ||
      event?.decoded_payload ||
      body?.decoded_payload ||
      body?.data ||
      body;
    const deviceIds = event?.end_device_ids || {};

    const uniqueIdCandidates = buildUniqueIdCandidates(
      decodedPayload,
      deviceIds,
      body,
    );
    const existingDeviceId = await findExistingUniqueId(
      uniqueIdCandidates,
      getDeviceById,
    );
    const existingWeatherDeviceId = await findExistingUniqueId(
      uniqueIdCandidates,
      getWeatherDeviceById,
    );
    const unique_id =
      existingDeviceId ??
      existingWeatherDeviceId ??
      firstDefined(...uniqueIdCandidates);

    if (unique_id === null || unique_id === undefined) {
      return new Response(
        JSON.stringify({
          status: 0,
          msg: "Invalid TTN payload: provide numeric unique_id or a stable TTN dev_eui/device_id",
        }),
        { status: 400 },
      );
    }

    const battery = parseNumberCandidate(
      firstDefined(decodedPayload.battery, decodedPayload.batt),
    );
    const level = parseNumberCandidate(
      firstDefined(decodedPayload.level, decodedPayload.distance),
    );
    const reception = parseNumberCandidate(
      decodedPayload.reception,
      event?.uplink_message?.rx_metadata?.[0]?.rssi,
    );
    const temp = parseNumberCandidate(
      firstDefined(decodedPayload.temp, decodedPayload.temperature),
    );
    const humidity = parseNumberCandidate(decodedPayload.humidity);
    const bin_height = parseNumberCandidate(decodedPayload.bin_height);
    const h2s = parseNumberCandidate(
      firstDefined(decodedPayload.h2s, decodedPayload.h2s_ppm),
    );
    const smoke = parseNumberCandidate(
      firstDefined(decodedPayload.smoke, decodedPayload.smoke_ppm),
    );
    const nh3 = parseNumberCandidate(
      firstDefined(decodedPayload.nh3, decodedPayload.nh3_ppm),
    );
    const receivedAt = new Date();

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
        { status: 400 },
      );
    }

    const weatherUpdateFields = {};
    if (battery !== undefined) weatherUpdateFields.battery = battery;
    if (reception !== undefined) weatherUpdateFields.reception = reception;
    if (temp !== undefined) weatherUpdateFields.temp = temp;
    if (humidity !== undefined) weatherUpdateFields.humidity = humidity;

    if (Object.keys(weatherUpdateFields).length > 0) {
      weatherUpdateFields.timestamp = receivedAt;

      let weatherDeviceData;
      try {
        weatherDeviceData = await getWeatherDeviceById(unique_id);
      } catch (error) {
        if (error.message === "Weather device not found") {
          weatherDeviceData = null;
        } else {
          throw error;
        }
      }

      if (!weatherDeviceData) {
        await insertNewWeatherDevice({
          unique_id,
          ...weatherUpdateFields,
          is_registered: false,
        });
      } else {
        await updateWeatherDevice(unique_id, weatherUpdateFields);
      }
    }

    updateFields.timestamp = receivedAt;

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
        { status: 200 },
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
      const totalSensorToBottom = Number(deviceData.bin_height);
      const fillableDepth = 70;
      const measuredDistance = Number(level);
      const trashHeight = totalSensorToBottom - measuredDistance;

      let level_in_percents = Math.round((trashHeight * 100) / fillableDepth);
      level_in_percents = Math.max(0, Math.min(100, level_in_percents));

      const historicalData = {
        unique_id,
        level_in_percents,
        saved_time: receivedAt,
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
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing TTN webhook:", error.message);
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
