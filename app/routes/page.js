// routes/page.js
'use client'
import React, { useState, useEffect } from "react";
import MapView from "@/components/MapView";
import {
  calculateFillRate,
  estimateHoursUntilFull,
  predictFullTime,
  binsDueForPickup,
  findLowFillRateBins,
} from "@/utils/routeBinPredictions";
import {
  fetchBinDevices,
  fetchHistoricalData,
  fetchRecentRoutes,
  createRoute,
  updateRouteStatus,
  deleteRoute
} from '@/lib/dataProvider';
import { convertLevelToPercentage, pickDevicesWithIssues } from '@/utils/deviceHelpers';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const Routes = () => {
  const { session } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [predictedDevices, setPredictedDevices] = useState([]);
  const [newPredicted, setNewPredicted] = useState([]);
  const [historical, setHistorical] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [travelMode, setTravelMode] = useState("WALKING");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [directions, setDirections] = useState(null);
  const [devicesToWorkOn, setDevicesToWorkOn] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [filters, setFilters] = useState({
    changeBattery: true,
    emptyBin: true,
  });

  let fillRates;
  let numHours;
  let predictedTimes;
  let lowFillRateBins;

  useEffect(() => {
    if (!session) {
      router.push('/login');
    }
    else {
      router.push('/routes');
    }
  }, [session, router]);

  useEffect(() => {
    if (predictedDevices.length > 0 && allDevices.length > 0) {
      const updatedDevices = allDevices.filter((device) =>
        predictedDevices.includes(device.unique_id)
      );
      setNewPredicted(updatedDevices);
    }
  }, [predictedDevices, allDevices]);

  const getDevices = async () => {
    const data = await fetchBinDevices();
    if (data.length > 0) {
      let tmpAll = convertLevelToPercentage(data);
      setAllDevices(tmpAll);
      const filteredDevices = pickDevicesWithIssues(tmpAll);
      setDevices(filteredDevices);
    }
  };

  const getDevicesHistorical = async () => {
    const data = await fetchHistoricalData();
    setHistorical(data);
  };

  useEffect(() => {
    if (historical.length > 0) {
      fillRates = calculateFillRate(historical);
      numHours = estimateHoursUntilFull(historical, fillRates);
      predictedTimes = predictFullTime(historical, numHours);
      let tmpArray = binsDueForPickup(predictedTimes, 6);
      setPredictedDevices(tmpArray);

      lowFillRateBins = findLowFillRateBins(fillRates);
    }
  }, [historical]);

  const mergeAndSetDevices = (filteredDevices) => {
    const filteredIds = new Set(filteredDevices.map((device) => device.unique_id));
    const uniquePredictedDevices = newPredicted.filter((device) => !filteredIds.has(device.unique_id));
    const combinedDevices = [...filteredDevices, ...uniquePredictedDevices];
    setDevices(combinedDevices);
  };

  useEffect(() => {
    if (newPredicted.length > 0 && allDevices.length > 0) {
      const filteredDevices = pickDevicesWithIssues(allDevices);
      mergeAndSetDevices(filteredDevices);
    }
  }, [newPredicted, allDevices]);

  useEffect(() => {
    getDevices();
    getDevicesHistorical();
    getRoutes(); // Fetch routes here

    const unsubscribeDevice = subscribeToTableChanges('devices', (payload) => {
      console.log('Device change received!', payload);
      switch (payload.eventType) {
        case 'INSERT':
          setDevices((prevDevices) => [...prevDevices, payload.new]);
          break;
        case 'UPDATE':
          setDevices((prevDevices) =>
            prevDevices.map((device) =>
              device.id === payload.new.id ? payload.new : device
            )
          );
          break;
        case 'DELETE':
          setDevices((prevDevices) =>
            prevDevices.filter((device) => device.id !== payload.old.id)
          );
          break;
        default:
          break;
      }
    });

    const unsubscribeHistorical = subscribeToTableChanges('historical', (payload) => {
      console.log('Historical change received!', payload);
      switch (payload.eventType) {
        case 'INSERT':
          setHistorical((prevHistorical) => [...prevHistorical, payload.new]);
          break;
        case 'UPDATE':
          setHistorical((prevHistorical) =>
            prevHistorical.map((entry) =>
              entry.id === payload.new.id ? payload.new : entry
            )
          );
          break;
        case 'DELETE':
          setHistorical((prevHistorical) =>
            prevHistorical.filter((entry) => entry.id !== payload.old.id)
          );
          break;
        default:
          break;
      }
    });

    const unsubscribeRoutes = subscribeToTableChanges('routes', () => {
      console.log('Route change received!');
      getRoutes();
    });

    return () => {
      unsubscribeDevice();
      unsubscribeHistorical();
      unsubscribeRoutes();
    };
  }, []);

  const handleFilterChange = (e) => {
    const { name, checked, type } = e.target;
    console.log(`Filter changed: ${name}, Checked: ${checked}`);
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: type === "checkbox" ? checked : e.target.value,
    }));
  };

  useEffect(() => {
    const filterDevices = () => {
      const filtered = devices.filter((device) => {
        const needsBatteryChange = device.battery < 25;
        const needsEmptying = device.level >= 80;
        const isPredicted = predictedDevices.includes(device.unique_id);

        return (
          (filters.changeBattery && needsBatteryChange) ||
          (filters.emptyBin && (needsEmptying || isPredicted))
        );
      });
      setDevicesToWorkOn(filtered);
      if (filtered.length === 0) {
        setDirections(null);
        setEstimatedTime("");
      }
    };
    filterDevices();
  }, [filters, devices, predictedDevices]);

  const decideWorkToDo = (bin) => {
    let emptyBin = false;
    let changeBattery = false;

    if (filters.emptyBin && bin.level >= 80) {
      emptyBin = true;
    }

    if (filters.changeBattery && bin.battery < 25) {
      changeBattery = true;
    }

    return {
      emptyBin,
      changeBattery,
    };
  };

  const getIndicatorColor = (bin) => {
    if (bin.level >= 80) return 'bg-red-500';
    if (bin.battery < 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderWorkToDo = () => {
    if (!devicesToWorkOn.length) return;

    return devicesToWorkOn.map((device) => {
      const { emptyBin, changeBattery } = decideWorkToDo(device);
      return (
        <div key={device.id} className="bg-white p-4 mb-4 rounded-lg shadow-md relative">
          <div className={`absolute top-0 left-0 h-full w-2 ${getIndicatorColor(device)}`} />
          <p className="text-black">
            <strong>Device ID:</strong> {device.unique_id}
          </p>
          <div>
            {emptyBin && (
              <div className="text-black">
                Empty Bin
              </div>
            )}
            {changeBattery && (
              <div className="text-black">
                Change Battery
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const createNewRoute = async () => {
    if (!devicesToWorkOn.length) return;

    const route = {
      employeeid: 1, // Replace with actual user ID
      deviceids: devicesToWorkOn.map((device) => device.unique_id),
      emptybin: filters.emptyBin,
      changebattery: filters.changeBattery,
      status: 'pending',
      timestamp: new Date(),
    };

    const { data, error } = await createRoute(route);
    if (!error) {
      console.log('Route created successfully:', data);
      getRoutes();
    }
  };

  const getRoutes = async () => {
    const data = await fetchRecentRoutes();
    setAllRoutes(data);
  };

  const startRoute = async (id) => {
    const { data, error } = await updateRouteStatus(id, 'started', 'started');
    if (!error) {
      console.log('Route started:', data);
      getRoutes();
    }
  };

  const finishRoute = async (id) => {
    const { data, error } = await updateRouteStatus(id, 'finished', 'finished');
    if (!error) {
      console.log('Route finished:', data);
      getRoutes();
    }
  };

  const deleteRouteById = async (id) => {
    const { data, error } = await deleteRoute(id);
    if (!error) {
      console.log('Route deleted:', data);
      getRoutes();
    }
  };

  const fetchDirections = async (devicesToWorkOn, travelMode) => {
    if (devicesToWorkOn.length < 2) {
      setDirections(null);
      setEstimatedTime("");
      return;
    }

    const waypoints = devicesToWorkOn.slice(1, -1).map((bin) => ({
      location: { lat: bin.lat, lng: bin.lng },
      stopover: true,
    }));

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: devicesToWorkOn[0].lat, lng: devicesToWorkOn[0].lng },
        destination: {
          lat: devicesToWorkOn[devicesToWorkOn.length - 1].lat,
          lng: devicesToWorkOn[devicesToWorkOn.length - 1].lng,
        },
        waypoints: waypoints,
        travelMode: travelMode,
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          const duration = result.routes[0].legs.reduce(
            (total, leg) => total + leg.duration.value,
            0
          );
          setEstimatedTime(`${Math.floor(duration / 60)} minutes`);
        } else {
          console.error(`Directions request failed due to ${status}`);
        }
      }
    );
  };


  //original algo used before implementing google's 'optimizeWaypoints'
  //commenting out the button linked to this function since no longer necessary
  const optimizeRoute = () => {
    if (devicesToWorkOn.length < 2) return;

    // A basic greedy algorithm for TSP (Nearest Neighbor)
    const optimizedDevices = [devicesToWorkOn[0]];
    const remainingDevices = devicesToWorkOn.slice(1);

    while (remainingDevices.length > 0) {
      const lastDevice = optimizedDevices[optimizedDevices.length - 1];
      let nearestDeviceIndex = 0;
      let minDistance = Number.MAX_VALUE;

      for (let i = 0; i < remainingDevices.length; i++) {
        const distance = calculateDistance(lastDevice, remainingDevices[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestDeviceIndex = i;
        }
      }

      optimizedDevices.push(remainingDevices[nearestDeviceIndex]);
      remainingDevices.splice(nearestDeviceIndex, 1);
    }

    setDevicesToWorkOn(optimizedDevices);
    fetchDirections(optimizedDevices, travelMode);
  };

  const calculateDistance = (device1, device2) => {
    const lat1 = device1.lat;
    const lng1 = device1.lng;
    const lat2 = device2.lat;
    const lng2 = device2.lng;
    const R = 6371; // Radius of the Earth in km

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    return distance;
  };

  useEffect(() => {
    if (devicesToWorkOn.length > 0) {
      fetchDirections(devicesToWorkOn, travelMode);
    }
  }, [devicesToWorkOn, travelMode]);

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-4 flex flex-col space-y-4">
          <div className="bg-gray-100 p-6 rounded-lg shadow-md mb-4">
            <h1 className="text-2xl font-bold mb-4">Manage Routes</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0 mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="changeBattery"
                  checked={filters.changeBattery}
                  onChange={handleFilterChange}
                />
                <span>Change Battery</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="emptyBin"
                  checked={filters.emptyBin}
                  onChange={handleFilterChange}
                />
                <span>Empty Bin</span>
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
                <span>Estimated time:</span>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value)}
                  className="border border-gray-300 p-2 rounded"
                >
                  <option value="DRIVING">Driving</option>
                  <option value="WALKING">Walking</option>
                </select>
                <span>{estimatedTime}</span>
              </div>
              {/* <button
                onClick={optimizeRoute}
                className="bg-purple-500 text-white px-4 py-2 rounded"
              >
                Optimize Route
              </button> */}
              <button
                onClick={createNewRoute}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Start Route
              </button>
            </div>
            <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
              <div className="w-full lg:w-2/3 p-4 bg-white rounded shadow-md">
                <MapView
                  devices={devicesToWorkOn}
                  directions={directions}
                  mapWidth="100%"
                  mapHeight="510px"
                  travelMode={travelMode}
                  fetchDirections={fetchDirections}
                />
              </div>
              <div className="w-full lg:w-1/3 p-4 bg-white rounded shadow-md flex flex-col space-y-4">
                <h3 className="text-lg font-bold mb-2">Route Summary</h3>
                <p className="mb-4">Total Bins: {devicesToWorkOn.length}</p>
                {renderWorkToDo()}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border-collapse">
              <thead>
                <tr className="border border-gray-300">
                  <th className="p-2 border border-gray-300">Route ID</th>
                  {/* <th className="p-2 border border-gray-300">Created By</th> */}
                  <th className="p-2 border border-gray-300">Bin Id's</th>
                  <th className="p-2 border border-gray-300">Status</th>
                  <th className="p-2 border border-gray-300">Created at</th>
                  <th className="p-2 border border-gray-300">Started</th>
                  <th className="p-2 border border-gray-300">Finished</th>
                  <th className="p-2 border border-gray-300">Controls</th>
                </tr>
              </thead>
              <tbody>
                {allRoutes.length > 0 ? (
                  allRoutes.map((route) => (
                    <tr key={route.id} className="border border-gray-300">
                      <td className="p-2 border border-gray-300">{route.id}</td>
                      {/* <td className="p-2 border border-gray-300">{route.employeeid}</td> */}
                      <td className="p-2 border border-gray-300">{route.deviceids.join(", ")}</td>
                      <td className="p-2 border border-gray-300">{route.status}</td>
                      <td className="p-2 border border-gray-300">{new Date(route.timestamp).toLocaleString()}</td>
                      <td className="p-2 border border-gray-300">
                        {route.started !== null ? new Date(route.started).toLocaleString() : null}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {route.finished !== null ? new Date(route.finished).toLocaleString() : null}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {route.status === "pending" && (
                          <button onClick={() => startRoute(route.id)} className="bg-green-500 text-white px-2 py-1 rounded">
                            Start
                          </button>
                        )}
                        {route.status === "started" && (
                          <button onClick={() => finishRoute(route.id)} className="bg-blue-500 text-white px-2 py-1 rounded">
                            Complete
                          </button>
                        )}
                        {route.status === "finished" && (
                          <button onClick={() => deleteRouteById(route.id)} className="bg-red-500 text-white px-2 py-1 rounded">
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-2 border border-gray-300 text-center">No routes available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Routes;
