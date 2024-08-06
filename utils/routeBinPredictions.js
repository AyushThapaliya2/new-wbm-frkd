// Utility page for Routes/page.js  
// This page calculates fill rate of bins for the routes page, determines how many hours until full
// Sets the predicted full time/date and then returns a list of bins that should be added to the route



const THRESHOLD_IN_HOURS = 6;
const MAX_FILL_PERCENT = 75;
const LOW_FILL_RATE_LIMIT = 0.5;



export function calculateFillRate(binsData) {
  //console.log("lets see bins to check inp: ", binsData);
  const fillRates = {};

  // Sort the data by saved_time for each unique_id
  binsData.sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));

  // Object to store ongoing data for each unique_id
  const ongoingData = {};

  binsData.forEach(bin => {
    if (!ongoingData[bin.unique_id]) {
      // Initialize data for a unique_id
      ongoingData[bin.unique_id] = {
        lastLevel: bin.level_in_percents,
        lastTime: new Date(bin.saved_time),
        rateSum: 0,
        timeSum: 0
      };
    } else {
      const data = ongoingData[bin.unique_id];
      const currentTime = new Date(bin.saved_time);
      const deltaTime = (currentTime - data.lastTime) / 3600000; // Convert milliseconds to hours

      if (bin.level_in_percents >= data.lastLevel) {
        // Only calculate positive rates (ignoring negative rates which indicate a reset)
        if (deltaTime > 0) {
          const deltaLevel = bin.level_in_percents - data.lastLevel;
          const rate = deltaLevel / deltaTime;

          // Update ongoing sums
          data.rateSum += rate * deltaTime;
          data.timeSum += deltaTime;
        }
      } else {
        // Detected a reset, possibly due to emptying, reset sums
        data.rateSum = 0;
        data.timeSum = 0;
      }

      // Update last known values
      data.lastLevel = bin.level_in_percents;
      data.lastTime = currentTime;
    }
  });

  // Calculate the average rate for each unique_id
  Object.keys(ongoingData).forEach(id => {
    const data = ongoingData[id];
    if (data.timeSum > 0) {
      fillRates[id] = data.rateSum / data.timeSum;
    } else {
      fillRates[id] = 0; // Default to 0 if no positive rate time was accumulated
    }
  });

  //console.log("Fill Rates: ", fillRates);
  return fillRates;
}

export function estimateHoursUntilFull(binsData, fillRates) {
  const hoursUntilFull = {};
  
  // Finding the latest data entry for each bin to determine its current fill level
  const latestData = {};

  binsData.forEach(bin => {
    if (!latestData[bin.unique_id] || new Date(bin.saved_time) > new Date(latestData[bin.unique_id].saved_time)) {
      latestData[bin.unique_id] = bin;  // Store the latest data for each unique_id
    }
  });

  // Calculate the number of hours until the bin is full for each bin
  Object.keys(latestData).forEach(uniqueId => {
    const latest = latestData[uniqueId];
    const currentFillLevel = latest.level_in_percents;
    const fillRate = fillRates[uniqueId];

    if (fillRate > 0) {  // Only calculate if the fill rate is positive
      const remainingCapacity = MAX_FILL_PERCENT - currentFillLevel; // Remaining capacity until it reaches the threshold
      const hours = remainingCapacity / fillRate;
      hoursUntilFull[uniqueId] = hours;
    } else {
      hoursUntilFull[uniqueId] = Infinity; // If fill rate is 0 or negative, it will never fill (or data might be incorrect)
    }
  });

  //console.log("Hours until full: ", hoursUntilFull);
  return hoursUntilFull;
}

export function predictFullTime(binsData, hoursUntilFull) {
    const predictedFullTimes = {};

    // Finding the latest data entry for each bin to get the last saved_time
    const latestData = {};

    binsData.forEach(bin => {
        if (!latestData[bin.unique_id] || new Date(bin.saved_time) > new Date(latestData[bin.unique_id].saved_time)) {
            latestData[bin.unique_id] = bin;  // Store the latest data for each unique_id
        }
    });

    // Calculate the predicted full timestamp for each bin
    Object.keys(hoursUntilFull).forEach(uniqueId => {
        const latest = latestData[uniqueId];
        const hours = hoursUntilFull[uniqueId];
        if (hours !== Infinity) {
            const lastPingTime = new Date(latest.saved_time);
            // console.log(`Last Ping Time for Bin ${uniqueId}: ${lastPingTime.toISOString()} (UTC)`);
            // console.log(`Hours until full for Bin ${uniqueId}: ${hours}`);

            // Calculate the number of milliseconds to add
            const millisecondsToAdd = hours * 3600000;  // Convert hours to milliseconds
            const fullTime = new Date(lastPingTime.getTime() + millisecondsToAdd);
            // console.log(`Predicted Full Time for Bin ${uniqueId}: ${fullTime.toISOString()} (UTC)`);

            predictedFullTimes[uniqueId] = fullTime.toISOString();  // Convert to ISO string for consistency
        } else {
            predictedFullTimes[uniqueId] = "Never full under current conditions";
        }
    });

    return predictedFullTimes;
}



export function binsDueForPickup(predictedTimes, thresholdInHours = THRESHOLD_IN_HOURS) {
  const binsForPickup = [];
  const currentDateTime = new Date(); // Current time
  let currentTime;

  Object.keys(predictedTimes).forEach(uniqueId => {
    
    let predictedTime = new Date(predictedTimes[uniqueId]);
    const adjust = predictedTime.getTimezoneOffset() * 60 * 1000; // Convert minutes to milliseconds.
    predictedTime = new Date(predictedTime.getTime() + adjust); 
    // console.log("predicted TIME: ", predictedTime);
    currentTime = new Date(currentDateTime.getTime());
    const thresholdTime = new Date(currentTime.getTime() + thresholdInHours * 3600000); // Current time + threshold
    // console.log("CURRENT TIME: ", currentTime);
    if (predictedTime <= thresholdTime) {
      binsForPickup.push(parseInt(uniqueId, 10));
    }
  });

  //console.log("Bins marked for pickup: ", binsForPickup);
  return binsForPickup;
}

export function findLowFillRateBins(fillRates) {
  const lowFillRateBins = [];

  // Iterate over the fill rates dictionary
  Object.keys(fillRates).forEach(uniqueId => {
      if (fillRates[uniqueId] < LOW_FILL_RATE_LIMIT) {
          lowFillRateBins.push(uniqueId);
      }
  });

  // console.log("Bins with low fill rates: ", lowFillRateBins);
  return lowFillRateBins;
}

