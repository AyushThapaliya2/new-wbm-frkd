 // Calculate average fill rates
 export const calculateAverageFillRates = (data) => {
    const averageFillRates = {};
  
    const groupedByDevice = data.reduce((acc, item) => {
      if (!acc[item.unique_id]) {
        acc[item.unique_id] = [];
      }
      acc[item.unique_id].push(item);
      return acc;
    }, {});
  
    for (const [unique_id, records] of Object.entries(groupedByDevice)) {
      let totalFillRate = 0;
      let totalIntervals = 0;
      let intervalSum = 0;
      let intervalCount = 0;
      let previousItem = null;
  
      records.forEach((item) => {
        if (previousItem) {
          const timeDiff = (new Date(item.saved_time) - new Date(previousItem.saved_time)) / (1000 * 60 * 60); // in hours
          const levelDiff = item.level_in_percents - previousItem.level_in_percents;
  
          //if bin is above 20% full and drops to below 5% we can assume it was emptied. this accounts for when bins are emptied before full level (>75%)
          if (previousItem.level_in_percents > 20 && item.level_in_percents <= 5) {
            if (intervalCount > 0) {
              totalFillRate += intervalSum / intervalCount;
              totalIntervals++;
            }
            intervalSum = 0;
            intervalCount = 0;
          } else {
            intervalSum += levelDiff / timeDiff;
            intervalCount++;
          }
        }
        previousItem = item;
      });
  
      if (intervalCount > 0) {
        totalFillRate += intervalSum / intervalCount;
        totalIntervals++;
      }
  
      averageFillRates[unique_id] = totalIntervals > 0 ? totalFillRate / totalIntervals : 0;
    }
  
    return averageFillRates;
  };
  
  // Calculate emptying events
  export const calculateEmptyingEvents = (data) => {
    const emptyingEvents = {};
  
    const groupedByDevice = data.reduce((acc, item) => {
      if (!acc[item.unique_id]) {
        acc[item.unique_id] = [];
      }
      acc[item.unique_id].push(item);
      return acc;
    }, {});
  
    for (const [unique_id, records] of Object.entries(groupedByDevice)) {
      let emptyCount = 0;
      let previousItem = null;
  
      records.forEach((item) => {
        if (previousItem) {
          // If bin is above 20% full and drops to below 5%, we can assume it was emptied
          if (previousItem.level_in_percents > 20 && item.level_in_percents <= 5) {
            emptyCount++;
          }
        }
        previousItem = item;
      });
  
      emptyingEvents[unique_id] = emptyCount;
    }
  
    return emptyingEvents;
  };
  
  // Summarize the "out of range" pings (above 100% or below 0%)
  //shouldn't occur very often if device is setup properly
  //but it can help to detect something light sitting on top (> 100%) or errors with bin height setting
  export const summarizeAnomalies = (anomalies) => {
    const summary = {};
    anomalies.forEach((level, time) => {
      if (!summary[level]) {
        summary[level] = {
          count: 0,
          times: []
        };
      }
      summary[level].count++;
      summary[level].times.push(time);
    });
    return Object.entries(summary).map(([level, data]) => ({
      level: level,
      occurrences: data.count,
      times: data.times.join(", ")
    }));
  };
  
  // Summarize sudden changes
  export const summarizeSuddenChanges = (changes) => {
    const summary = {};
    changes.forEach(change => {
      const key = `${change.from}% to ${change.to}%`;
      if (!summary[key]) {
        summary[key] = [];
      }
      summary[key].push(`between ${change.start} and ${change.end}`);
    });
    return summary;
  };