// Utility functions for routes/devices pages
export const helperToConvertLevelToPercentage = (devices) => {
    let tmpDevices = devices.map((device) => {
      let distanceInCM = device.level;
      let binHeight = device.bin_height;
      let trashHeight = binHeight - distanceInCM;
      device.level = parseInt((trashHeight * 100) / binHeight);
      device.lat = parseFloat(device.lat);
      device.lng = parseFloat(device.lng);
      return device;
    });
    return tmpDevices;
  };
  
  export const pickDevicesWithIssues = (devices) => {
    let tmpDevices = devices.filter((device) => {
      return device.level >= 80 || device.battery <= 25;
    });
    return tmpDevices;
  };