'use client';
import React, { useState, useEffect } from "react";
import { fetchHistoricalData, clearHistoricalData } from '@/lib/supabaseClient';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';
import ChartComponent from '@/components/ChartComponent';
import DownloadReport from '@/components/DownloadReport';

function Data() {
  const colors = [
    "rgba(255, 99, 132, 0.5)",  // red
    "rgba(54, 162, 235, 0.5)",  // blue
    "rgba(255, 206, 86, 0.5)",  // yellow
    "rgba(75, 192, 192, 0.5)",  // green
    "rgba(153, 102, 255, 0.5)", // purple
    "rgba(255, 159, 64, 0.5)"   // orange
  ];

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true
      },
      x: {
        type: 'time',
        time: {
          unit: 'day',
          tooltipFormat: 'MM/dd/yyyy HH:mm',
          displayFormats: {
            hour: 'HH:mm',
            day: 'MM/dd/yyyy'
          }
        },
        ticks: {
          source: 'auto',
          autoSkip: true,
          maxTicksLimit: 20
        }
      }
    },
    animation: {
      duration: 5
    },
    hover: {
      animationDuration: 5
    },
    responsiveAnimationDuration: 0
  };

  const [mockData, setHistorical] = useState([]);
  const [activeTab, setActiveTab] = useState('fillLevels');
  const [fillLevelsOverTime, setFillLevelsOverTime] = useState({
    labels: [],
    datasets: []
  });
  const [lastSavedTimes, setLastSavedTimes] = useState({});
  const [devicePings, setDevicePings] = useState({});
  const [deviceInsights, setDeviceInsights] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedPanel, setExpandedPanel] = useState(null);

  const togglePanel = (id) => {
    setExpandedPanel(expandedPanel === id ? null : id);
  };

  useEffect(() => {
    const getHistorical = async () => {
      const data = await fetchHistoricalData();
      setHistorical(data);

      // Calculate start and end dates based on the fetched data
      const dates = data.map(item => new Date(item.saved_time));
      const minDate = dates.length ? new Date(Math.min(...dates)) : new Date();
      let maxDate = dates.length ? new Date(Math.max(...dates)) : new Date();
      maxDate.setDate(maxDate.getDate() + 1);

      setStartDate(minDate.toISOString().split('T')[0]);
      setEndDate(maxDate.toISOString().split('T')[0]);
    };

    getHistorical();

    const unsubscribe = subscribeToTableChanges('historical', (payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          setHistorical((prevData) => [...prevData, payload.new]);
          break;
        case 'UPDATE':
          setHistorical((prevData) =>
            prevData.map((item) =>
              item.id === payload.new.id ? payload.new : item
            )
          );
          break;
        case 'DELETE':
          setHistorical((prevData) =>
            prevData.filter((item) => item.id !== payload.old.id)
          );
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const clearHistorical = async () => {
    const success = await clearHistoricalData();
    if (!success) {
      alert('Error clearing historical data');
    } else {
      setHistorical([]);
    }
  };

  useEffect(() => {
    updateChartData();
  }, [mockData, startDate, endDate]);

  const updateChartData = () => {
    const filteredData = mockData.filter(item => {
      const itemDate = new Date(item.saved_time);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return itemDate >= start && itemDate <= end;
    });

    const groupedByDevice = filteredData.reduce((acc, item) => {
      if (!acc[item.unique_id]) {
        acc[item.unique_id] = { data: [], lastSavedTime: null };
      }
      const itemDate = new Date(item.saved_time);
      const adjust = itemDate.getTimezoneOffset() * 60 * 1000;
      const dateToSave = new Date(itemDate.getTime() + adjust);

      acc[item.unique_id].data.push({
        ...item,
        saved_time: dateToSave
      });

      if (!acc[item.unique_id].lastSavedTime || dateToSave > acc[item.unique_id].lastSavedTime) {
        acc[item.unique_id].lastSavedTime = dateToSave;
      }
      return acc;
    }, {});

    const datasets = [];
    const lastTimes = {};
    const pings = {};
    const insights = {};

    for (const [unique_id, { data, lastSavedTime }] of Object.entries(groupedByDevice)) {
      const colorIndex = unique_id % colors.length;
      datasets.push({
        label: `Device ${unique_id}`,
        data: data.map(item => ({
          x: item.saved_time,
          y: item.level_in_percents
        })),
        borderColor: colors[colorIndex],
        backgroundColor: colors[colorIndex],
        fill: false,
        lineTension: 0.1
      });
      lastTimes[unique_id] = lastSavedTime.toLocaleString();
      pings[unique_id] = data.length;

      let anomalies = new Map();
      let rapidChanges = [];
      let previousItem = null;

      data.forEach(item => {
        if (item.level_in_percents < 0 || item.level_in_percents > 100) {
          anomalies.set(item.saved_time.toLocaleString(), `${item.level_in_percents}%`);
        }
        if (previousItem && Math.abs(previousItem.level_in_percents - item.level_in_percents) > 30) {
          rapidChanges.push({
            from: previousItem.level_in_percents,
            to: item.level_in_percents,
            start: previousItem.saved_time.toLocaleString(),
            end: item.saved_time.toLocaleString()
          });
        }
        previousItem = item;
      });

      insights[unique_id] = {
        totalAnomalies: anomalies.size,
        totalRapidChanges: rapidChanges.length,
        commonAnomalies: summarizeAnomalies(anomalies),
        frequentRapidChangesSummary: summarizeRapidChanges(rapidChanges)
      };
    }

    setFillLevelsOverTime({
      datasets
    });
    setLastSavedTimes(lastTimes);
    setDevicePings(pings);
    setDeviceInsights(insights);
  };

  const summarizeAnomalies = (anomalies) => {
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

  const summarizeRapidChanges = (changes) => {
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
  return (
    <div className="max-w-7xl mx-auto my-4 p-6 bg-white rounded-lg shadow-md text-gray-800 font-sans">
      <div className="flex justify-between items-center px-5 mb-10">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-2 text-lg"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-2 text-lg"
        />
      </div>
      <div className="flex flex-col gap-8">
        <div className="w-full bg-gray-200 rounded-lg p-8 shadow-md">
          <h2>Fill Levels Over Time</h2>
          <ChartComponent data={fillLevelsOverTime} options={chartOptions} />
        </div>
        <div className="w-full bg-gray-100 rounded-lg p-8 shadow-md">
          <h2 className="text-2xl mb-4">Device Insights</h2>
          <div className="flex justify-end mb-4">
            <DownloadReport
              deviceInsights={deviceInsights}
              devicePings={devicePings}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
          {Object.entries(deviceInsights).map(([id, insight]) => (
            <div key={id} className="bg-white rounded-lg p-5 shadow-md mb-5">
              <h3 className="text-gray-800 mb-4 cursor-pointer" onClick={() => togglePanel(id)}>
                Device {id} <span>{expandedPanel === id ? '-' : '+'}</span>
              </h3>
              {expandedPanel === id && (
                <div>
                  <div className="mb-4">
                    <strong>Total Pings:</strong> {devicePings[id]}
                    <h4>Out of Range</h4>
                    <table className="w-full mt-2 mb-4">
                      <thead>
                        <tr>
                          <th className="border-b border-gray-300 py-2">Level</th>
                          <th className="border-b border-gray-300 py-2">Occurrences</th>
                          <th className="border-b border-gray-300 py-2">Times</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insight.commonAnomalies.map(anomaly => (
                          <tr key={`${id}-${anomaly.level}`}>
                            <td className="border-b border-gray-300 py-2">{anomaly.level}</td>
                            <td className="border-b border-gray-300 py-2">{anomaly.occurrences}</td>
                            <td className="border-b border-gray-300 py-2">{anomaly.times}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mb-4">
                    <h4>Rapid Changes</h4>
                    <table className="w-full mt-2 mb-4">
                      <thead>
                        <tr>
                          <th className="border-b border-gray-300 py-2">Change</th>
                          <th className="border-b border-gray-300 py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(insight.frequentRapidChangesSummary).map(([change, times]) => (
                          <tr key={change}>
                            <td className="border-b border-gray-300 py-2">{change}</td>
                            <td className="border-b border-gray-300 py-2">{times.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <button className="px-4 py-2 border border-gray-800 rounded text-lg text-white bg-red-600 shadow-md transition duration-300" onClick={clearHistorical}>
        Clear Historical Data
      </button>
    </div>
  );
}

export default Data;

