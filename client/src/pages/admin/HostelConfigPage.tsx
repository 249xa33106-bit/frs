import React, { useState, useEffect } from 'react';
import { Building2, Layers, DoorClosed, Plus, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export const HostelConfigPage: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHierarchy = async () => {
    try {
      const res = await api.get('/hostel/hierarchy');
      setHierarchy(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  if (loading) {
    return <div className="py-16 text-center text-xs text-slate-400">Loading hostel structure...</div>;
  }

  const hostels = hierarchy?.hostels || [];
  const blocks = hierarchy?.blocks || [];
  const floors = hierarchy?.floors || [];
  const rooms = hierarchy?.rooms || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Hostel Premises & Room Configuration
          </h1>
          <p className="text-xs text-slate-500">
            Structure and layout: Tagore Complex • 3 Blocks • 12 Floors • 300 Rooms • 1,200 Student Capacity
          </p>
        </div>
        <button
          onClick={fetchHierarchy}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Complex Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        {hostels.map((h: any) => (
          <div key={h.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">{h.name}</h3>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  {h.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{h.address}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Campus Coordinates:</span>
                <span>{h.latitude}, {h.longitude}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px]">Geofence Radius:</span>
                <span>{h.geofence_radius_meters} meters</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Blocks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {blocks.map((b: any) => {
          const blockFloors = floors.filter((f: any) => f.block_id === b.id);
          const blockRooms = rooms.filter((r: any) => r.block_id === b.id);
          const totalOccupants = blockRooms.reduce((acc: number, r: any) => acc + (r.student_count || 4), 0);

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-base flex items-center justify-center">
                    {b.code.slice(-1)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{b.code} • {b.gender}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Floors</span>
                  <span className="font-bold text-slate-800 text-sm">4 Floors</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Rooms</span>
                  <span className="font-bold text-slate-800 text-sm">{blockRooms.length}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Capacity</span>
                  <span className="font-bold text-slate-800 text-sm">400 Beds</span>
                </div>
              </div>

              {/* Floor listings */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                {blockFloors.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50">
                    <span className="font-semibold text-slate-800">{f.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">25 Rooms (100 Beds)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
