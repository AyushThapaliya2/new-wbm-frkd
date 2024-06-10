'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

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

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      fetchUserDetails();
      fetchDevices();
      fetchFeedbacks();
    }
  }, [session, router]);

  useEffect(() => {
    const feedbackSubscription = supabase
      .channel('public:feedbacks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, payload => {
        fetchFeedbacks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(feedbackSubscription);
    };
  }, []);

  const fetchUserDetails = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('fname, lname')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching user details:', error);
    } else {
      setUserDetails(data);
      setUserLoading(false);
    }
  };

  const fetchDevices = async () => {
    const { data, error } = await supabase.from('devices').select('*');
    if (error) {
      console.error('Error fetching devices:', error);
    } else {
      setDevices(data);
    }
  };

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase.from('feedbacks').select('*');
    if (error) {
      console.error('Error fetching feedbacks:', error);
    } else {
      setFeedbacks(data);
      setSortedFeedbacks(data);
      setLoading(false);
    }
  };

  const addFeedback = async () => {
    const { data, error } = await supabase.from('feedbacks').insert([{
      device_id: deviceIdForFeedback,
      reported_by_id: session.user.id,
      reported_by_name: `${userDetails.fname} ${userDetails.lname}`,
      title: deviceTitleForFeedback,
      description: deviceDescriptionForFeedback
    }]);
    if (error) {
      console.error('Error adding feedback:', error);
    } else {
      clearInputs();
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
          <div className="mb-6">
            <select
              value={deviceIdForFeedback}
              onChange={(e) => setDeviceIdForFeedback(e.target.value)}
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
              onChange={(e) => setDeviceTitleForFeedback(e.target.value)}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            />
            <textarea
              rows="5"
              placeholder="Describe the issue in detail..."
              value={deviceDescriptionForFeedback}
              onChange={(e) => setDeviceDescriptionForFeedback(e.target.value)}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            ></textarea>
            <button onClick={addFeedback} className="p-2 bg-blue-500 text-white rounded">Submit Feedback</button>
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
