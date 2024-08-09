'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchBinDevices, fetchFeedbacks, fetchHistoricalData, fetchRecentRoutes } from '@/lib/dataProvider';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';
import { FaRoute } from 'react-icons/fa';
import ChartComponent from '@/components/ChartComponent';
import { convertLevelToPercentage } from '@/utils/deviceHelpers'; 

export default function Home() {
  const { session, isAdmin } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState({});
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [recentRoutes, setRecentRoutes] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      router.push('/dashboard');
    }
  }, [session, router]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const devices = await fetchBinDevices();
        const convertedDevices = convertLevelToPercentage(devices);  

        const totalDevices = convertedDevices.length;
        const fullBins = convertedDevices.filter(device => device.level >= 80).length;
        const lowBatteryBins = convertedDevices.filter(device => device.battery <= 20).length;

        const feedback = await fetchFeedbacks();
        const routes = await fetchRecentRoutes();

        setSummary({
          totalDevices,
          fullBins,
          lowBatteryBins
        });

        setRecentFeedback(feedback.slice(0, 5) || []);
        setRecentRoutes(routes || []);
      } catch (error) {
        console.error('Error fetching summary:', error);
      }
    };

    const fetchChartData = async () => {
      try {
        const data = await fetchHistoricalData();

        // Find the most recent date in the data
        const mostRecentDate = new Date(Math.max(...data.map(item => new Date(item.saved_time))));

        // Calculate the date 7 days prior to the most recent date
        const date7DaysAgo = new Date(mostRecentDate);
        date7DaysAgo.setDate(mostRecentDate.getDate() - 7);

        // Filter data to include only entries from the last 7 days
        const filteredData = data.filter(item => {
          const itemDate = new Date(item.saved_time);
          return itemDate >= date7DaysAgo && itemDate <= mostRecentDate;
        });

        const labels = filteredData.map(item => new Date(item.saved_time));
        const dataset = {
          label: 'Bin Levels Over Time',
          data: filteredData.map(item => item.level_in_percents),
          backgroundColor: 'rgba(75, 192, 192, 0.2)', // Semi-transparent color for overlaps
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        };

        setChartData({
          labels,
          datasets: [dataset]
        });
      } catch (error) {
        console.error('Error fetching chart data:', error);
      }
    };

    fetchSummary();
    fetchChartData();

    //Set up real-time subscriptions
    const unsubscribeDevices = subscribeToTableChanges('devices', fetchSummary);
    const unsubscribeFeedbacks = subscribeToTableChanges('feedbacks', fetchSummary);
    const unsubscribeHistorical = subscribeToTableChanges('historical', fetchChartData);

    // Cleanup function
    return () => {
      unsubscribeDevices();
      unsubscribeFeedbacks();
      unsubscribeHistorical();
    };
    
  }, []);

  const chartOptions = {
    scales: {
      y: { beginAtZero: true },
      x: {
        type: 'time',
        time: { unit: 'day', tooltipFormat: 'MM/dd/yyyy HH:mm', displayFormats: { day: 'MM/dd/yyyy' } },
        ticks: { source: 'auto', autoSkip: true, maxTicksLimit: 20 }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    onClick: () => router.push('/historical-data') // Redirect to historical data page on click
  };

  return (
    <div className="mx-auto p-6 bg-gray-100 rounded-lg shadow-md text-gray-800 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg shadow-md flex items-center">
          <div>
            <h2 className="text-xl font-bold">Total Devices</h2>
            <p className="text-2xl">{summary.totalDevices}</p>
          </div>
        </div>
        <div className="bg-red-100 p-4 rounded-lg shadow-md flex items-center">
          <div>
            <h2 className="text-xl font-bold">Full Bins</h2>
            <p className="text-2xl">{summary.fullBins}</p>
          </div>
        </div>
        <div className="bg-yellow-100 p-4 rounded-lg shadow-md flex items-center">
          <div>
            <h2 className="text-xl font-bold">Low Battery Bins</h2>
            <p className="text-2xl">{summary.lowBatteryBins}</p>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Bin Levels Over Time</h2>
          <div className="relative h-96">
            <ChartComponent type="line" data={chartData} options={chartOptions} />
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex justify-center">
            <div
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer transform hover:-translate-y-1"
              onClick={() => router.push('/routes')}
            >
              <div className="flex items-center justify-center mb-4">
                <FaRoute className="text-6xl text-blue-500" />
              </div>
              {summary.fullBins > 0 || summary.lowBatteryBins > 0 ? (
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-center text-green-600">Routes Available</h3>
                  <p className="text-lg text-center text-gray-700">There are bins that need to be emptied or have low battery. Please check your routes.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-center text-red-600">No Routes Available</h3>
                  <p className="text-lg text-center text-gray-700">All bins are in good condition. No routes to be done at this time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/feedback')}
        >
          <h2 className="text-2xl font-bold mb-4">Recent Feedback</h2>
          <ul>
            {recentFeedback.map(feedback => (
              <li key={feedback.id} className="mb-2">
                <h3 className="font-bold">{feedback.title}</h3>
                <p>Device: {feedback.device_id} -- {feedback.description}</p>
                <small className="text-gray-500">{new Date(feedback.timestamp).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/routes')}
        >
          <h2 className="text-2xl font-bold mb-4">Recent Routes</h2>
          <ul>
            {recentRoutes.map(route => (
              <li key={route.id} className="mb-2">
                <h3 className="font-bold">Route ID: {route.id}</h3>
                <p>Status: {route.status}</p>
                <small className="text-gray-500">{new Date(route.timestamp).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
