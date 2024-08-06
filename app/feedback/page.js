'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchUserDetails, fetchBinDevices, fetchWeatherDevices, fetchFeedbacks, addFeedback, updateFeedback } from '@/lib/dataProvider';
import { FaTrash, FaSun } from 'react-icons/fa';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';

export default function FeedbackPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [deviceType, setDeviceType] = useState("waste bins");
  const [devices, setDevices] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [sortedFeedbacks, setSortedFeedbacks] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceIdForFeedback, setDeviceIdForFeedback] = useState("");
  const [deviceTitleForFeedback, setDeviceTitleForFeedback] = useState("");
  const [deviceDescriptionForFeedback, setDeviceDescriptionForFeedback] = useState("");
  const [userDetails, setUserDetails] = useState({ fname: '', lname: '' });
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      fetchUserDetails(session.user.id).then(data => {
        if (data) setUserDetails(data);
        setUserLoading(false);
      });

      if (deviceType === "waste bins") {
        fetchBinDevices().then(data => setDevices(data));
      } else {
        fetchWeatherDevices().then(data => setDevices(data));
      }

      fetchFeedbacks().then(data => {
        setFeedbacks(data);
        setSortedFeedbacks(data);
        setLoading(false);
      });
    }
  }, [session, router, deviceType]);

  const handleAddFeedback = async () => {
    if (!deviceIdForFeedback) {
      setFormError("Please select a device.");
      return;
    }
    if (!deviceTitleForFeedback) {
      setFormError("Please enter an issue title.");
      return;
    }
    if (!deviceDescriptionForFeedback) {
      setFormError("Please describe the issue.");
      return;
    }

    const feedback = {
      device_id: deviceIdForFeedback,
      reported_by_id: session.user.id,
      reported_by_name: `${userDetails.fname} ${userDetails.lname}`,
      title: deviceTitleForFeedback,
      description: deviceDescriptionForFeedback,
      devicetype: deviceType === 'waste bins' ? 'Bin' : 'Weather',
      completed: false
    };

    const { data, error } = await addFeedback(feedback);

    if (error) {
      setFormError("Failed to submit feedback. Please try again.");
    } else {
      clearInputs();
      setSuccessMessage("Feedback submitted successfully.");
      setFormError(""); // Clear error message on successful submission

      // Clear the success message after a few seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

      // Refresh feedbacks after adding a new one
      fetchFeedbacks().then(data => {
        setFeedbacks(data);
        setSortedFeedbacks(data);
      });
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToTableChanges('feedbacks', () => {
      fetchFeedbacks().then(data => {
        setFeedbacks(data);
        setSortedFeedbacks(data);
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const sortFeedbacks = (key) => {
    let sortedData = [...sortedFeedbacks];
    let direction = "ascending";

    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
      sortedData.reverse();
    } else {
      sortedData.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        if (!isNaN(Number(valA)) && !isNaN(Number(valB))) {
          valA = Number(valA);
          valB = Number(valB);
        }

        if (valA < valB) {
          return -1;
        }
        if (valA > valB) {
          return 1;
        }
        return 0;
      });
    }

    setSortedFeedbacks(sortedData);
    setSortConfig({ key, direction });
  };

  const clearInputs = () => {
    setDeviceIdForFeedback("");
    setDeviceTitleForFeedback("");
    setDeviceDescriptionForFeedback("");
  };

  const handleToggleCompleted = async (feedbackId, currentStatus) => {
    const updatedFeedback = {
      completed: !currentStatus,
      completed_date: !currentStatus ? new Date().toISOString() : null
    };
    const { data, error } = await updateFeedback(feedbackId, updatedFeedback);

    if (error) {
      console.error("Failed to update feedback. Please try again.");
    } else {
      handleFeedbackUpdate(data);
    }
  };

  const handleFeedbackUpdate = (updatedFeedback) => {
    if (!updatedFeedback) return;

    setFeedbacks((prevFeedbacks) =>
      prevFeedbacks.map((feedback) =>
        feedback.id === updatedFeedback.id ? updatedFeedback : feedback
      )
    );
    setSortedFeedbacks((prevSortedFeedbacks) =>
      prevSortedFeedbacks.map((feedback) =>
        feedback.id === updatedFeedback.id ? updatedFeedback : feedback
      )
    );
  };

  const filteredFeedbacks = searchTerm
    ? sortedFeedbacks.filter((feedback) =>
        Object.values(feedback).some((value) =>
          value !== null && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : sortedFeedbacks;

  if (!session || !session.user) return null;

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row h-screen">
      <div className="flex-1 transition-all duration-300">
        <main className="p-4">
          <h1 className="text-2xl font-bold mb-4">Submit Feedback</h1>
          {formError && <p className="text-red-500 mb-4">{formError}</p>}
          {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}
          <div className="mb-6">
            <select
              value={deviceType}
              onChange={(e) => {
                setDeviceType(e.target.value);
                clearInputs();
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            >
              <option value="waste bins">
                <FaTrash className="inline mr-2" />Waste Bins
              </option>
              <option value="weather sensors">
                <FaSun className="inline mr-2" />Weather Sensors
              </option>
            </select>
            <select
              value={deviceIdForFeedback}
              onChange={(e) => {
                setDeviceIdForFeedback(e.target.value);
                setFormError(""); // Clear any existing error when user changes the value
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            >
              <option value="">Select the device to report</option>
              {devices.map((device) => (
                <option key={device.id} value={device.unique_id}>
                  ID: {device.unique_id}, Battery: {device.battery}%, Level: {device.level}%
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Issue Title..."
              value={deviceTitleForFeedback}
              onChange={(e) => {
                setDeviceTitleForFeedback(e.target.value);
                setFormError(""); // Clear any existing error when user changes the value
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            />
            <textarea
              rows="5"
              placeholder="Describe the issue in detail..."
              value={deviceDescriptionForFeedback}
              onChange={(e) => {
                setDeviceDescriptionForFeedback(e.target.value);
                setFormError(""); // Clear any existing error when user changes the value
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            ></textarea>
            <button onClick={handleAddFeedback} className="p-2 bg-blue-500 text-white rounded">Submit Feedback</button>
          </div>

          <h2 className="text-xl font-bold mb-4">Feedbacks</h2>
          <input
            type="text"
            placeholder="Search..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 border border-gray-300 rounded w-full mb-4"
          />

          {loading || userLoading ? (
            <p>Loading...</p>
          ) : (
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("reported_by_name")}>Employee</th>
                  <th className="px-4 py-2 border-b">Device Type</th>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("device_id")}>Device</th>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("title")}>Title</th>
                  <th className="px-4 py-2 border-b">Description</th>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("timestamp")}>Date Created</th>
                  <th className="px-4 py-2 border-b">Addressed</th>
                  <th className="px-4 py-2 border-b">Date Addressed</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedbacks.length > 0 ? (
                  filteredFeedbacks.map((feedback) => (
                    <tr key={feedback.id}>
                      <td className="px-4 py-2 border-b">{feedback.reported_by_name}</td>
                      <td className="px-4 py-2 border-b">{feedback.devicetype}</td>
                      <td className="px-4 py-2 border-b">{feedback.device_id}</td>
                      <td className="px-4 py-2 border-b">{feedback.title}</td>
                      <td className="px-4 py-2 border-b">{feedback.description}</td>
                      <td className="px-4 py-2 border-b">{new Date(feedback.timestamp).toLocaleDateString()}</td>
                      <td className="px-4 py-2 border-b">
                        {session.user.role === 'admin' ? (
                          <input
                            type="checkbox"
                            checked={feedback.completed}
                            onChange={() => handleToggleCompleted(feedback.id, feedback.completed)}
                          />
                        ) : (
                          feedback.completed ? 'Yes' : 'No'
                        )}
                      </td>
                      <td className="px-4 py-2 border-b">{feedback.completed_date ? new Date(feedback.completed_date).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-2 text-center border-b">No feedback found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </div>
  );
}
