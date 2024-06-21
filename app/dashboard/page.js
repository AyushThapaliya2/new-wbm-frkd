'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

export default function Home() {
  const { session } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState({});
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [recentRoutes, setRecentRoutes] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const secretToken = process.env.SECRET_TOKEN;
    console.log(process.env.NEXT_PUBLIC_SECRET_TOKEN);
  useEffect(() => {
    if (!session) {
      router.push('/login');
    }
  }, [session, router]);

  const helperToConvertLevelToPercentage = (devices) => {
    return devices.map((device) => {
      let distanceInCM = device.level;
      let binHeight = device.bin_height;
      let trashHeight = binHeight - distanceInCM;
      device.level = parseInt((trashHeight * 100) / binHeight);
      device.lat = parseFloat(device.lat);
      device.lng = parseFloat(device.lng);
      return device;
    });
  };

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('*')
          .eq('is_registered', true);

        if (devicesError) {
          console.error(devicesError);
          return;
        }

        const convertedDevices = helperToConvertLevelToPercentage(devices);

        const totalDevices = convertedDevices.length;
        const fullBins = convertedDevices.filter(device => device.level >= 80).length;
        const lowBatteryBins = convertedDevices.filter(device => device.battery <= 20).length;

        const { data: feedback, error: feedbackError } = await supabase
          .from('feedbacks')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(5);

        if (feedbackError) {
          console.error(feedbackError);
          return;
        }

        const { data: routes, error: routesError } = await supabase
          .from('routes')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(5);

        if (routesError) {
          console.error(routesError);
          return;
        }

        setSummary({
          totalDevices,
          fullBins,
          lowBatteryBins
        });

        setRecentFeedback(feedback || []);
        setRecentRoutes(routes || []);
      } catch (error) {
        console.error('Error fetching summary:', error);
      }
    };

    const fetchChartData = async () => {
      try {
        const { data, error } = await supabase
          .from('historical')
          .select('saved_time, level_in_percents')
          .order('saved_time', { ascending: true });

        if (!error) {
          const labels = data.map(item => new Date(item.saved_time));
          const dataset = {
            label: 'Bin Levels Over Time',
            data: data.map(item => item.level_in_percents),
            borderColor: 'rgba(75, 192, 192, 0.5)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            fill: false
          };

          setChartData({
            labels,
            datasets: [dataset]
          });
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      }
    };

    fetchSummary();
    fetchChartData();
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
    maintainAspectRatio: false
  };

  return (
    <div className="mx-auto p-6 bg-white rounded-lg shadow-md text-gray-800 font-sans">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-bold">Total Devices</h2>
          <p className="text-2xl">{summary.totalDevices}</p>
        </div>
        <div className="bg-red-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-bold">Full Bins</h2>
          <p className="text-2xl">{summary.fullBins}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-bold">Low Battery Bins</h2>
          <p className="text-2xl">{summary.lowBatteryBins}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Bin Levels Over Time</h2>
        <div className="relative h-96">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-100 p-4 rounded-lg shadow-md">
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

        <div className="bg-gray-100 p-4 rounded-lg shadow-md">
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
