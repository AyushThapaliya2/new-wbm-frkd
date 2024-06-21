import React from 'react';

const Legend = ({ deviceType }) => {
  if (deviceType === 'weather') {
    return (
      <div className="flex flex-col space-y-2 p-4">
        <div className="flex items-center">
          <span className="w-4 h-4 bg-green-400 inline-block mr-2"></span>
          <span>Battery OK</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-red-500 inline-block mr-2"></span>
          <span>Change Battery</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 p-4">
      <div className="flex items-center">
        <span className="w-4 h-4 bg-purple-500 inline-block mr-2"></span>
        <span>Full bin + low battery</span>
      </div>
      <div className="flex items-center">
        <span className="w-4 h-4 bg-red-500 inline-block mr-2"></span>
        <span>Full bin</span>
      </div>
      <div className="flex items-center">
        <span className="w-4 h-4 bg-orange-300 inline-block mr-2"></span>
        <span>Low battery</span>
      </div>
      <div className="flex items-center">
        <span className="w-4 h-4 bg-green-400 inline-block mr-2"></span>
        <span>No issues</span>
      </div>
    </div>
  );
};

function ListView({ devices, deviceType }) {
  const getIndicatorColor = (level, battery) => {
    if (deviceType === 'weather') {
      return battery > 20 ? 'bg-green-400' : 'bg-red-500';
    } else {
      if (level >= 80 && battery <= 20) {
        return 'bg-purple-500'; // Both full bin and low battery
      } else if (level >= 80) {
        return 'bg-red-500'; // Full bin
      } else if (battery <= 20) {
        return 'bg-orange-300'; // Low battery
      } else {
        return 'bg-green-400'; // No issues
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <Legend deviceType={deviceType} />
      <table className="min-w-full bg-gray-200 border-collapse block md:table">
        <thead className="block md:table-header-group">
          <tr className="border border-gray-300 md:border-none block md:table-row absolute -top-full md:top-auto -left-full md:left-auto md:relative">
            <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">ID</th>
            {deviceType === 'bins' && (
              <>
                <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Alerts</th>
                <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Bin Height</th>
                <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Level</th>
              </>
            )}
            <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Battery</th>
            <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Last Checked</th>
            <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Reception</th>
            <th className="bg-gray-600 p-2 text-white font-bold md:border md:border-gray-300 text-left block md:table-cell">Controls</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {devices.map((device) => (
            <tr key={device.id} className="border border-gray-400 md:border-none block md:table-row">
              <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">
                <div className="flex items-center">
                  <span className={`w-4 h-4 mr-2 ${getIndicatorColor(device.level, device.battery)}`}></span>
                  {device.unique_id}
                </div>
              </td>
              {deviceType === 'bins' && (
                <>
                  <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{/* Alerts */}</td>
                  <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{device.bin_height}</td>
                  <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{device.level}%</td>
                </>
              )}
              <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{device.battery}%</td>
              <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{new Date(device.timestamp).toLocaleString()}</td>
              <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">{device.reception}</td>
              <td className="p-2 md:border md:border-gray-400 text-left block md:table-cell">
                <button className="bg-blue-500 text-white px-4 py-2">Submit Feedback</button>
                <button className="bg-green-500 text-white px-4 py-2">View Historical Data</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListView;
