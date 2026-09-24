import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { WaterMeterMonitoringPage } from './pages/WaterMeterMonitoringPage';
import type { DeviceOption } from './types/meter.types';
import { meterService } from './services/meter.service';
import { FullDashboardSkeleton } from './components/common/LoadingSkeleton';

export function App() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceOption | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function loadDevices() {
      try {
        setIsLoadingDevices(true);
        const apiDevices = await meterService.getAvailableDevices(true);
        if (active) {
          const defaultFallbackList: DeviceOption[] = [
            { id: 'FLOSTAT_001', name: 'FLOSTAT_001', facility: 'Default Site', status: 'online', location: 'Main Facility • Main Overhead Tank' },
            { id: 'FLOSTAT_002', name: 'FLOSTAT_002', facility: 'Default Site', status: 'online', location: 'Utility Block • Ground Tank' },
            { id: 'FLOSTAT_003', name: 'FLOSTAT_003', facility: 'Default Site', status: 'online', location: 'Building A • Block A Tank' },
            { id: 'FLOSTAT_004', name: 'FLOSTAT_004', facility: 'Default Site', status: 'offline', location: 'Building B • Block B Tank' },
            { id: 'FLOSTAT_005', name: 'FLOSTAT_005', facility: 'Default Site', status: 'online', location: 'Plant Facility • Fire Hydrant Tank' },
            { id: 'FLOSTAT_006', name: 'FLOSTAT_006', facility: 'Default Site', status: 'online', location: 'Plant Facility • Cooling Tower Tank' },
            { id: 'FLOSTAT_007', name: 'FLOSTAT_007', facility: 'Default Site', status: 'online', location: 'Plant Facility • RO Plant Tank' },
            { id: 'FLOSTAT_008', name: 'FLOSTAT_008', facility: 'Default Site', status: 'online', location: 'Plant Facility • Commercial Block Tank' },
            { id: 'FLOSTAT_009', name: 'FLOSTAT_009', facility: 'Default Site', status: 'online', location: 'Plant Facility • Residential Feed Tank' },
            { id: 'FLOSTAT_010', name: 'FLOSTAT_010', facility: 'Default Site', status: 'online', location: 'Plant Facility • HVAC Chiller Tank' },
            { id: 'FLOSTAT_011', name: 'FLOSTAT_011', facility: 'Default Site', status: 'online', location: 'Plant Facility • Industrial Inflow Tank' },
            { id: 'FLOSTAT_012', name: 'FLOSTAT_012', facility: 'Default Site', status: 'online', location: 'Plant Facility • Utility Reserve Tank' },
            { id: 'FLOSTAT_013', name: 'FLOSTAT_013', facility: 'Default Site', status: 'online', location: 'Plant Facility • Process Water Tank' },
            { id: 'FLOSTAT_014', name: 'FLOSTAT_014', facility: 'Default Site', status: 'online', location: 'Plant Facility • Secondary Storage Tank' },
          ];

          const deviceList = apiDevices && apiDevices.length > 0 ? apiDevices : defaultFallbackList;
          const savedDeviceId = localStorage.getItem('flostat_selected_device_id');
          const restoredDevice = savedDeviceId ? deviceList.find((d) => d.id === savedDeviceId) || deviceList[0] : deviceList[0];

          setDevices(deviceList);
          setSelectedDevice(restoredDevice);
        }
      } catch (err) {
        console.error('Failed to load devices:', err);
        if (active) {
          const fallbackList: DeviceOption[] = [
            { id: 'FLOSTAT_001', name: 'FLOSTAT_001', facility: 'Default Site', status: 'online', location: 'Main Facility • Main Overhead Tank' },
            { id: 'FLOSTAT_002', name: 'FLOSTAT_002', facility: 'Default Site', status: 'online', location: 'Utility Block • Ground Tank' },
            { id: 'FLOSTAT_003', name: 'FLOSTAT_003', facility: 'Default Site', status: 'online', location: 'Building A • Block A Tank' },
            { id: 'FLOSTAT_004', name: 'FLOSTAT_004', facility: 'Default Site', status: 'offline', location: 'Building B • Block B Tank' },
            { id: 'FLOSTAT_005', name: 'FLOSTAT_005', facility: 'Default Site', status: 'online', location: 'Plant Facility • Fire Hydrant Tank' },
            { id: 'FLOSTAT_006', name: 'FLOSTAT_006', facility: 'Default Site', status: 'online', location: 'Plant Facility • Cooling Tower Tank' },
            { id: 'FLOSTAT_007', name: 'FLOSTAT_007', facility: 'Default Site', status: 'online', location: 'Plant Facility • RO Plant Tank' },
            { id: 'FLOSTAT_008', name: 'FLOSTAT_008', facility: 'Default Site', status: 'online', location: 'Plant Facility • Commercial Block Tank' },
            { id: 'FLOSTAT_009', name: 'FLOSTAT_009', facility: 'Default Site', status: 'online', location: 'Plant Facility • Residential Feed Tank' },
            { id: 'FLOSTAT_010', name: 'FLOSTAT_010', facility: 'Default Site', status: 'online', location: 'Plant Facility • HVAC Chiller Tank' },
            { id: 'FLOSTAT_011', name: 'FLOSTAT_011', facility: 'Default Site', status: 'online', location: 'Plant Facility • Industrial Inflow Tank' },
            { id: 'FLOSTAT_012', name: 'FLOSTAT_012', facility: 'Default Site', status: 'online', location: 'Plant Facility • Utility Reserve Tank' },
            { id: 'FLOSTAT_013', name: 'FLOSTAT_013', facility: 'Default Site', status: 'online', location: 'Plant Facility • Process Water Tank' },
            { id: 'FLOSTAT_014', name: 'FLOSTAT_014', facility: 'Default Site', status: 'online', location: 'Plant Facility • Secondary Storage Tank' },
          ];
          const savedDeviceId = localStorage.getItem('flostat_selected_device_id');
          const restoredDevice = savedDeviceId ? fallbackList.find((d) => d.id === savedDeviceId) || fallbackList[0] : fallbackList[0];

          setDevices(fallbackList);
          setSelectedDevice(restoredDevice);
        }
      } finally {
        if (active) {
          setIsLoadingDevices(false);
        }
      }
    }
    loadDevices();
    return () => {
      active = false;
    };
  }, []);

  const handleDeviceChange = (dev: DeviceOption) => {
    setSelectedDevice(dev);
    localStorage.setItem('flostat_selected_device_id', dev.id);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      <main className="flex-1 bg-[#F8FAFC]">
        {isLoadingDevices ? (
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <FullDashboardSkeleton />
          </div>
        ) : (
          <WaterMeterMonitoringPage
            devStateOverride={undefined}
            connectedDataStream={null}
            devices={devices}
            selectedDevice={selectedDevice}
            onDeviceChange={handleDeviceChange}
          />
        )}
      </main>
      <Analytics />
    </div>
  );
}

export default App;
