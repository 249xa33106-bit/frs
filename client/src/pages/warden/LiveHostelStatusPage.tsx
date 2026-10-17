import React, { useState, useEffect } from 'react';
import { Radio, Home, Footprints, CalendarCheck, AlertTriangle, Building, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';

export const LiveHostelStatusPage: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [hRes, sRes] = await Promise.all([
        api.get('/hostel/hierarchy'),
        api.get('/warden/stats')
      ]);
      setHierarchy(hRes);
      setStats(sRes);
    } catch (e) {
      console.error('Failed to load status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Loading live hostel presence data...</span>
      </div>
    );
  }

  const kpis = stats?.kpis || { totalStudents: 1200, insideHostel: 1120, currentlyOutside: 25, onLeave: 45 };

  // Calculate block breakdowns
  const blocks = hierarchy?.blocks || [];
  const rooms = hierarchy?.rooms || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-600 animate-pulse" />
            Live Hostel Presence & Occupancy
          </h1>
          <p className="text-xs text-slate-500">
            Real-time status of 1,200 hostel residents across all accommodation wings
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Real-time Status Distribution Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Inside Hostel</span>
            <Home className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{kpis.insideHostel}</div>
          <p className="text-[11px] text-emerald-600 mt-1">Verified on campus</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Currently Outside</span>
            <Footprints className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{kpis.currentlyOutside}</div>
          <p className="text-[11px] text-amber-600 mt-1">Legitimate day outing</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">On Approved Leave</span>
            <CalendarCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">{kpis.onLeave}</div>
          <p className="text-[11px] text-purple-600 mt-1">Home / night leaves</p>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Attention Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{kpis.attentionRequired}</div>
          <p className="text-[11px] text-rose-600 mt-1">Exceptions & overdue</p>
        </div>
      </div>

      {/* Block-wise Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {blocks.map((b: any) => {
          const blockRooms = rooms.filter((r: any) => r.block_id === b.id);
          const totalOccupants = blockRooms.reduce((acc: number, r: any) => acc + (r.student_count || 0), 0);
          const inside = blockRooms.reduce((acc: number, r: any) => acc + (r.inside_count || 0), 0);
          const outside = blockRooms.reduce((acc: number, r: any) => acc + (r.outside_count || 0), 0);
          const leave = blockRooms.reduce((acc: number, r: any) => acc + (r.leave_count || 0), 0);

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {b.code.slice(-1)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
                    <p className="text-[11px] text-slate-400">100 Rooms • 4 Floors</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-600">Occupancy & Presence</span>
                  <span className="text-blue-600">{totalOccupants} Students</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(inside / (totalOccupants || 1)) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Inside: ${inside}`}
                  />
                  <div
                    style={{ width: `${(outside / (totalOccupants || 1)) * 100}%` }}
                    className="bg-amber-400 h-full"
                    title={`Outside: ${outside}`}
                  />
                  <div
                    style={{ width: `${(leave / (totalOccupants || 1)) * 100}%` }}
                    className="bg-purple-500 h-full"
                    title={`On Leave: ${leave}`}
                  />
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                  <span className="font-bold text-base block">{inside}</span>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold">Inside</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                  <span className="font-bold text-base block">{outside}</span>
                  <span className="text-[10px] text-amber-600 uppercase font-semibold">Outside</span>
                </div>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-800">
                  <span className="font-bold text-base block">{leave}</span>
                  <span className="text-[10px] text-purple-600 uppercase font-semibold">Leave</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
