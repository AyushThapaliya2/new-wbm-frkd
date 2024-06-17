'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchUserDetails, fetchDevices, fetchFeedbacks, addFeedback } from '@/lib/supabaseClient';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';

export default function FeedbackPage() {
  const { session } = useAuth();
  const router = useRouter();
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
      fetchDevices().then(data => setDevices(data));
      fetchFeedbacks().then(data => {
        setFeedbacks(data);
        setSortedFeedbacks(data);
        setLoading(false);
      });
    }
  }, [session, router]);

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
      description: deviceDescriptionForFeedback
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
    }
  };

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

  const filteredFeedbacks = searchTerm
    ? sortedFeedbacks.filter((feedback) =>
        Object.values(feedback).some((value) =>
          value !== null && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : sortedFeedbacks;

  if (!session || !session.user) return null;

  return (
    <div className="flex h-screen">
      <div className="flex-1 transition-all duration-300">
        <main className="p-4">
          <h1 className="text-2xl font-bold mb-4">Submit Feedback</h1>
          {formError && <p className="text-red-500 mb-4">{formError}</p>}
          {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}
          <div className="mb-6">
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
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("device_id")}>Device</th>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("title")}>Title</th>
                  <th className="px-4 py-2 border-b">Description</th>
                  <th className="px-4 py-2 border-b" onClick={() => sortFeedbacks("timestamp")}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedbacks.length > 0 ? (
                  filteredFeedbacks.map((feedback) => (
                    <tr key={feedback.id}>
                      <td className="px-4 py-2 border-b">{feedback.reported_by_name}</td>
                      <td className="px-4 py-2 border-b">{feedback.device_id}</td>
                      <td className="px-4 py-2 border-b">{feedback.title}</td>
                      <td className="px-4 py-2 border-b">{feedback.description}</td>
                      <td className="px-4 py-2 border-b">{new Date(feedback.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-2 text-center border-b">No feedback found.</td>
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
