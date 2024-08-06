// Function to check if an email already exists
export const checkEmailExists = async (email) => {
    const response = await fetch('http://localhost:3000/api/check-email-exists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return data.exists;
  };
  
  // Function to create a new user
  export const createUser = async (user) => {
    const response = await fetch('http://localhost:3000/api/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    });
    const data = await response.json();
    return { data, error: data.error };
  };
  
  
  export const fetchUserByEmail = async (email) => {
    console.log('Fetching user by email:', email);
    const response = await fetch(`http://localhost:3000/api/users/${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    console.log('User data received:', data);
    return data.error ? null : data;
  };
  
  
  
  // Function to fetch user details
  export const fetchUserDetails = async (userId) => {
    const response = await fetch(`http://localhost:3000/api/user-details/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? null : data;
  };
  
  // Function to fetch devices
  export const fetchBinDevices = async () => {
    const response = await fetch('http://localhost:3000/api/bin-devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to fetch weather devices
  export const fetchWeatherDevices = async () => {
    const response = await fetch('http://localhost:3000/api/weather-devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to fetch unregistered bin devices
  export const fetchNewBinDevices = async () => {
    const response = await fetch('http://localhost:3000/api/new-bin-devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to fetch unregistered weather devices
  export const fetchNewWeatherDevices = async () => {
    const response = await fetch('http://localhost:3000/api/new-weather-devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to fetch feedbacks
  export const fetchFeedbacks = async () => {
    const response = await fetch('http://localhost:3000/api/feedbacks', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to add feedback
  export const addFeedback = async (feedback) => {
    const response = await fetch('http://localhost:3000/api/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedback),
    });
    const data = await response.json();
    return { data, error: data.error };
  };
  

// Function to update feedback
export const updateFeedback = async (feedbackId, updateData) => {
  const response = await fetch(`http://localhost:3000/api/feedbacks/${feedbackId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  const data = await response.json();
  return { data, error: data.error };
};
  
  
  // Function to fetch historical data
  export const fetchHistoricalData = async () => {
    const response = await fetch('http://localhost:3000/api/historical-data', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (data.error) {
      return [];
    }
    if (Array.isArray(data)) {
      data.sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));
    }
    return data;
  };
  
  // Function to clear historical data
  export const clearHistoricalData = async () => {
    const response = await fetch('http://localhost:3000/api/historical-data', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return !data.error;
  };
  
  // Function to update device registration
  export const updateDeviceRegistration = async (updatedDevice, deviceType) => {
    const response = await fetch('http://localhost:3000/api/update-device-registration', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updatedDevice, deviceType }),
    });
    const data = await response.json();
    return { data: data.data, error: data.error };
  };
  
  // Fetch routes for dashboard
  export const fetchRecentRoutes = async () => {
    const response = await fetch('http://localhost:3000/api/recent-routes', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.error ? [] : data;
  };
  
  // Function to create a new route
  export const createRoute = async (route) => {
    const response = await fetch('http://localhost:3000/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(route),
    });
    const data = await response.json();
    return { data: data.data, error: data.error };
  };
  
  // Function to update route status
  export const updateRouteStatus = async (id, status, timestampField) => {
    const response = await fetch('http://localhost:3000/api/update-route-status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, status, timestampField }),
    });
    const data = await response.json();
    return { data: data.data, error: data.error };
  };
  
  // Function to delete a route
  export const deleteRoute = async (id) => {
    const response = await fetch(`http://localhost:3000/api/routes/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return { data: data.data, error: data.error };
  };
  
  
  // Function to update device info
  export const updateDeviceInfo = async (updatedDevice, deviceType) => {
    const response = await fetch('http://localhost:3000/api/update-device-info', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updatedDevice, deviceType }),
    });
    const data = await response.json();
    return { data: data.data, error: data.error };
  };
  
  // Function to detect empty events
  export const fetchEmptyEvents = async () => {
    const response = await fetch('http://localhost:3000/api/historical-data', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  
    const data = await response.json();
  
    if (data.error) {
      console.error("Error fetching empty events:", data.error);
      return {};
    }
  
    if (Array.isArray(data)) {
      // Sort the data by unique_id and saved_time
      data.sort((a, b) => {
        if (a.unique_id !== b.unique_id) {
          return a.unique_id - b.unique_id;
        }
        return new Date(a.saved_time) - new Date(b.saved_time);
      });
  
      const emptyingCounts = {};
      let prevLevel = {};
  
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
  
        if (!prevLevel[record.unique_id]) {
          prevLevel[record.unique_id] = { level: null, time: null };
        }
  
        console.log(`Processing record ${i}:`, record);
  
        if (
          prevLevel[record.unique_id].level !== null &&
          prevLevel[record.unique_id].level >= 20 &&
          record.level_in_percents <= 10
        ) {
          if (!emptyingCounts[record.unique_id]) {
            emptyingCounts[record.unique_id] = 0;
          }
          emptyingCounts[record.unique_id]++;
          console.log(`Detected emptying event for device ${record.unique_id} at ${record.saved_time}`);
        }
  
        prevLevel[record.unique_id] = {
          level: record.level_in_percents,
          time: record.saved_time,
        };
      }
  
      console.log("Emptying counts:", emptyingCounts);
      return emptyingCounts;
    }
  
    console.log("No valid data received.");
    return {};
  };
  




  export const updateDevice = async (unique_id, updateFields) => {
    try {
      const response = await fetch('http://localhost:3000/api/update-device', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unique_id, updateFields }),
      });
      const data = await response.json();
      if (response.status !== 200) {
        throw new Error(data.error || 'Error updating device');
      }
      return data;
    } catch (error) {
      console.error('Error in updateDevice:', error.message);
      throw error;
    }
  };
  
  export const insertNewDevice = async (deviceData) => {
    try {
      const response = await fetch('http://localhost:3000/api/insert-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceData),
      });
      const data = await response.json();
      if (response.status !== 200) {
        throw new Error(data.error || 'Error inserting new device');
      }
      return data;
    } catch (error) {
      console.error('Error in insertNewDevice:', error.message);
      throw error;
    }
  };
  
  export const saveToHistorical = async (historicalData) => {
    try {
      const response = await fetch('http://localhost:3000/api/save-historical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historicalData),
      });
      const data = await response.json();
      if (response.status !== 200) {
        throw new Error(data.error || 'Error saving to historical');
      }
      return data;
    } catch (error) {
      console.error('Error in saveToHistorical:', error.message);
      throw error;
    }
  };
  
  export const getDeviceById = async (unique_id) => {
    try {
      const response = await fetch(`http://localhost:3000/api/device/${unique_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.status !== 200) {
        throw new Error(data.error || 'Device not found');
      }
      return data;
    } catch (error) {
      console.error('Error in getDeviceById:', error.message);
      throw error;
    }
  };


  export const updateWeatherDevice = async (unique_id, updateFields) => {
    const response = await fetch('http://localhost:3000/api/update-weather-device', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unique_id, updateFields }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  };
  
  export const insertNewWeatherDevice = async (deviceData) => {
    const response = await fetch('http://localhost:3000/api/insert-weather-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceData),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  };
  
  export const getWeatherDeviceById = async (unique_id) => {
    const response = await fetch(`http://localhost:3000/api/weather-device/${unique_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  };