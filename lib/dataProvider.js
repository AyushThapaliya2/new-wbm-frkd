const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL === 'true';

const dataProvider = useLocal ? require('./localDB') : require('./supabaseClient');
console.log(`Using ${useLocal ? 'local' : 'Supabase'} database`);

module.exports = {
  fetchUserDetails: dataProvider.fetchUserDetails,
  fetchBinDevices: dataProvider.fetchBinDevices,
  fetchWeatherDevices: dataProvider.fetchWeatherDevices,
  fetchNewBinDevices: dataProvider.fetchNewBinDevices,
  fetchNewWeatherDevices: dataProvider.fetchNewWeatherDevices,
  fetchFeedbacks: dataProvider.fetchFeedbacks,
  addFeedback: dataProvider.addFeedback,
  updateFeedback: dataProvider.updateFeedback,
  fetchHistoricalData: dataProvider.fetchHistoricalData,
  clearHistoricalData: dataProvider.clearHistoricalData,
  updateDeviceRegistration: dataProvider.updateDeviceRegistration,
  fetchRecentRoutes: dataProvider.fetchRecentRoutes,
  createRoute: dataProvider.createRoute,
  updateRouteStatus: dataProvider.updateRouteStatus,
  deleteRoute: dataProvider.deleteRoute,
  checkEmailExists: dataProvider.checkEmailExists,
  createUser: dataProvider.createUser,
  fetchUserByEmail: dataProvider.fetchUserByEmail,
  updateDeviceSoftware: dataProvider.updateDeviceSoftware,
  fetchEmptyEvents: dataProvider.fetchEmptyEvents,
  updateDeviceHardware: dataProvider.updateDeviceHardware,
  insertNewDevice: dataProvider.insertNewDevice,
  saveToHistorical: dataProvider.saveToHistorical,
  getDeviceById: dataProvider.getDeviceById,
  updateWeatherDevice: dataProvider.updateWeatherDevice,
  insertNewWeatherDevice: dataProvider.insertNewWeatherDevice,
  getWeatherDeviceById: dataProvider.getWeatherDeviceById,
};
