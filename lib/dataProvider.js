const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL === 'true';

let fetchUserDetails;
let fetchBinDevices;
let fetchWeatherDevices;
let fetchNewBinDevices;
let fetchNewWeatherDevices;
let fetchFeedbacks;
let addFeedback;
let updateFeedback;
let fetchHistoricalData;
let clearHistoricalData;
let updateDeviceRegistration;
let fetchRecentRoutes;
let createRoute;
let updateRouteStatus;
let deleteRoute;
let checkEmailExists;
let createUser;
let fetchUserByEmail;
let updateDeviceInfo;
let fetchEmptyEvents;
let updateDevice;
let insertNewDevice;
let saveToHistorical;
let getDeviceById;
let updateWeatherDevice;
let insertNewWeatherDevice;
let getWeatherDeviceById;

if (useLocal) {
  const localDB = require('./localDB');
  console.log("using local");
  fetchUserDetails = localDB.fetchUserDetails;
  fetchBinDevices = localDB.fetchBinDevices;
  fetchWeatherDevices = localDB.fetchWeatherDevices;
  fetchNewBinDevices = localDB.fetchNewBinDevices;
  fetchNewWeatherDevices = localDB.fetchNewWeatherDevices;
  fetchFeedbacks = localDB.fetchFeedbacks;
  addFeedback = localDB.addFeedback;
  updateFeedback = localDB.updateFeedback;
  fetchHistoricalData = localDB.fetchHistoricalData;
  clearHistoricalData = localDB.clearHistoricalData;
  updateDeviceRegistration = localDB.updateDeviceRegistration;
  fetchRecentRoutes = localDB.fetchRecentRoutes;
  createRoute = localDB.createRoute;
  updateRouteStatus = localDB.updateRouteStatus;
  deleteRoute = localDB.deleteRoute;
  checkEmailExists = localDB.checkEmailExists;
  createUser = localDB.createUser;
  fetchUserByEmail = localDB.fetchUserByEmail;
  updateDeviceInfo = localDB.updateDeviceInfo;
  fetchEmptyEvents = localDB.fetchEmptyEvents;
  updateDevice = localDB.updateDevice;
  insertNewDevice = localDB.insertNewDevice;
  saveToHistorical = localDB.saveToHistorical;
  getDeviceById = localDB.getDeviceById;
  updateWeatherDevice = localDB.updateWeatherDevice;
  insertNewWeatherDevice = localDB.insertNewWeatherDevice;
  getWeatherDeviceById = localDB.getWeatherDeviceById;
} else {
  const supabaseClient = require('./supabaseClient');
  console.log("using supa");
  fetchUserDetails = supabaseClient.fetchUserDetails;
  fetchBinDevices = supabaseClient.fetchBinDevices;
  fetchWeatherDevices = supabaseClient.fetchWeatherDevices;
  fetchNewBinDevices = supabaseClient.fetchNewBinDevices;
  fetchNewWeatherDevices = supabaseClient.fetchNewWeatherDevices;
  fetchFeedbacks = supabaseClient.fetchFeedbacks;
  addFeedback = supabaseClient.addFeedback;
  updateFeedback = supabaseClient.updateFeedback;
  fetchHistoricalData = supabaseClient.fetchHistoricalData;
  clearHistoricalData = supabaseClient.clearHistoricalData;
  updateDeviceRegistration = supabaseClient.updateDeviceRegistration;
  fetchRecentRoutes = supabaseClient.fetchRecentRoutes;
  createRoute = supabaseClient.createRoute;
  updateRouteStatus = supabaseClient.updateRouteStatus;
  deleteRoute = supabaseClient.deleteRoute;
  checkEmailExists = supabaseClient.checkEmailExists;
  createUser = supabaseClient.createUser;
  fetchUserByEmail = supabaseClient.fetchUserByEmail;
  updateDeviceInfo = supabaseClient.updateDeviceInfo;
  fetchEmptyEvents = supabaseClient.fetchEmptyEvents;
  updateDevice = supabaseClient.updateDevice;
  insertNewDevice = supabaseClient.insertNewDevice;
  saveToHistorical = supabaseClient.saveToHistorical;
  getDeviceById = supabaseClient.getDeviceById;
  updateWeatherDevice = supabaseClient.updateWeatherDevice;
  insertNewWeatherDevice = supabaseClient.insertNewWeatherDevice;
  getWeatherDeviceById = supabaseClient.getWeatherDeviceById;
}

module.exports = {
  fetchUserDetails,
  fetchBinDevices,
  fetchWeatherDevices,
  fetchNewBinDevices,
  fetchNewWeatherDevices,
  fetchFeedbacks,
  addFeedback,
  updateFeedback,
  fetchHistoricalData,
  clearHistoricalData,
  updateDeviceRegistration,
  fetchRecentRoutes,
  createRoute,
  updateRouteStatus,
  deleteRoute,
  checkEmailExists,
  createUser,
  fetchUserByEmail,
  updateDeviceInfo,
  fetchEmptyEvents,
  updateDevice,
  insertNewDevice,
  saveToHistorical,
  getDeviceById,
  updateWeatherDevice,
  insertNewWeatherDevice,
  getWeatherDeviceById,
};
