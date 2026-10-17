import React, { useState, useEffect } from 'react';
import { Building2, Layers, DoorClosed, Users, Phone, ArrowLeft, RefreshCw, User } from 'lucide-react';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';

interface RoomMonitoringPageProps {
  onSelectStudent?: (studentId: string) => void;
}

export const RoomMonitoringPage: React.FC<RoomMonitoringPageProps> = ({ onSelectStudent }) => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('block-a');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [roomStudents, setRoomStudents] = useState<any[]>([]);
  const [loadingRoomStudents, setLoadingRoomStudents] = useState(false);

  const fetchHierarchy = async () => {
    try {
      const res = await api.get('/hostel/hierarchy');
      setHierarchy(res);
      if (res.blocks?.length > 0 && !selectedBlockId) {
        setSelectedBlockId(res.blocks[0].id);
      }
      if (res.floors?.length > 0) {
        const firstFloor = res.floors.find((f: any) => f.block_id === (selectedBlockId || res.blocks[0].id));
        if (firstFloor) setSelectedFloorId(firstFloor.id);
      }
    } catch (err) {
      console.error('Failed to load hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  // Update floor when block changes
  useEffect(() => {
    if (hierarchy?.floors) {
      const firstFloor = hierarchy.floors.find((f: any) => f.block_id === selectedBlockId);
      if (firstFloor) {
        setSelectedFloorId(firstFloor.id);
      }
      setSelectedRoom(null);
      setRoomStudents([]);
    }
  }, [selectedBlockId]);

  // Load students for clicked room
  const handleRoomClick = async (room: any) => {
    setSelectedRoom(room);
    setLoadingRoomStudents(true);
    try {
      const res = await api.get(`/hostel/rooms/${room.id}`);
      setRoomStudents(res.students || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRoomStudents(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Loading room hierarchy...</span>
      </div>
    );
  }

  const blocks = hierarchy?.blocks || [];
  const floors = hierarchy?.floors?.filter((f: any) => f.block_id === selectedBlockId) || [];
  const rooms = hierarchy?.rooms?.filter((r: any) => r.floor_id === selectedFloorId) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Room-Wise Occupancy & Presence Explorer</h1>
          <p className="text-xs text-slate-500">
            Navigate Hostel → Block → Floor → Room to inspect student presence in real time
          </p>
        </div>
        <button
          onClick={fetchHierarchy}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Block Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {blocks.map((b: any) => (
          <button
            key={b.id}
            onClick={() => setSelectedBlockId(b.id)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
              selectedBlockId === b.id
                ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                selectedBlockId === b.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {b.code.slice(-1)}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{b.name}</p>
              <p className="text-xs text-slate-500">4 Floors • 100 Rooms</p>
            </div>
          </button>
        ))}
      </div>

      {/* Floor Selector Pills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1.5">
          <Layers className="w-4 h-4" /> Floor:
        </span>
        {floors.map((f: any) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedFloorId(f.id);
              setSelectedRoom(null);
              setRoomStudents([]);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFloorId === f.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Main Grid: Room Cards & Selected Room Occupant Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Rooms Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <DoorClosed className="w-4 h-4 text-blue-600" />
              Rooms on Selected Floor ({rooms.length} Rooms)
            </h3>
            <span className="text-xs text-slate-400">Click room to inspect occupants</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {rooms.map((r: any) => {
              const isSelected = selectedRoom?.id === r.id;
              const hasOutside = (r.outside_count || 0) > 0;
              const hasLeave = (r.leave_count || 0) > 0;

              return (
                <div
                  key={r.id}
                  onClick={() => handleRoomClick(r)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-blue-50/30 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold text-slate-900 text-sm">{r.room_number}</p>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {r.student_count || 4}/4 Beds
                  </span>

                  {/* Presence indicator dots */}
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {Array.from({ length: r.inside_count || 0 }).map((_, i) => (
                      <span key={`in-${i}`} className="w-2 h-2 rounded-full bg-emerald-500" title="Inside" />
                    ))}
                    {Array.from({ length: r.outside_count || 0 }).map((_, i) => (
                      <span key={`out-${i}`} className="w-2 h-2 rounded-full bg-amber-400" title="Outside" />
                    ))}
                    {Array.from({ length: r.leave_count || 0 }).map((_, i) => (
                      <span key={`lv-${i}`} className="w-2 h-2 rounded-full bg-purple-500" title="On Leave" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right col: Selected Room Occupants Inspector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          {selectedRoom ? (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Room Inspection
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-0.5">Room {selectedRoom.room_number}</h3>
                <p className="text-xs text-slate-500">
                  Capacity: {selectedRoom.capacity} Students • Occupied: {selectedRoom.student_count || 4}
                </p>
              </div>

              {loadingRoomStudents ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading student details...</div>
              ) : (
                <div className="space-y-3">
                  {roomStudents.map((std) => (
                    <div
                      key={std.id}
                      onClick={() => onSelectStudent && onSelectStudent(std.id)}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{std.full_name}</span>
                        {getStatusBadge(std.current_status)}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">Roll: {std.roll_number}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                        <span>Attendance: {getStatusBadge(std.today_attendance || 'Present')}</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" /> {std.phone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs">
              <DoorClosed className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No Room Selected</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Select any room card on the left grid to view resident student profiles and current presence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
