// Utility function for devices


export const convertLevelToPercentage = (devices) => {
    let tmpDevices = devices.map((device) => {
      let distanceInCM = device.level;
      let totalSensorToBottom = device.bin_height;
      let fillableDepth = 70;
      let trashHeight = totalSensorToBottom - distanceInCM;
      let levelInPercents = Math.round((trashHeight * 100) / fillableDepth);
      device.level = Math.max(0, Math.min(100, levelInPercents));
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
