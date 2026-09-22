import { useEffect, useState } from 'react';
import { MapPinned, Plus, Trash2, Users, UserPlus, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function ZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', route_order: '' });
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneStudents, setZoneStudents] = useState({ assigned: [], available: [] });
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadZones = () => {
    setLoading(true);
    api.get('/zones').then(res => setZones(res.data))
      .catch(() => toast.error('Failed to load delivery zones'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadZones(); }, []);

  const loadZoneStudents = (zone) => {
    setSelectedZone(zone);
    setSelectedStudentId('');
    setStudentsLoading(true);
    api.get(`/zones/${zone.id}/students`).then(res => setZoneStudents(res.data))
      .catch(() => toast.error('Failed to load students for this zone'))
      .finally(() => setStudentsLoading(false));
  };

  const assignStudent = async () => {
    if (!selectedStudentId || !selectedZone) return;
    setAssigning(true);
    try {
      await api.put(`/zones/${selectedZone.id}/students/${selectedStudentId}`);
      toast.success('Student assigned to zone');
      loadZoneStudents(selectedZone);
      loadZones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign student');
    } finally {
      setAssigning(false);
    }
  };

  const unassignStudent = async (student) => {
    if (!selectedZone) return;
    try {
      await api.delete(`/zones/${selectedZone.id}/students/${student.id}`);
      toast.success('Student removed from zone');
      loadZoneStudents(selectedZone);
      loadZones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove student');
    }
  };

  const createZone = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/zones', form);
      setForm({ name: '', description: '', route_order: '' });
      toast.success('Delivery zone created');
      loadZones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create zone');
    } finally {
      setSaving(false);
    }
  };

  const removeZone = async (zone) => {
    if (!window.confirm(`Remove “${zone.name}”? Its students will become unassigned.`)) return;
    try {
      await api.delete(`/zones/${zone.id}`);
      toast.success('Delivery zone removed');
      loadZones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove zone');
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Delivery Zones</h1>
        <p className="text-sm text-white/40 mt-1">Create areas, assign students, and dispatch meal deliveries zone by zone.</p>
      </div>

      <form onSubmit={createZone} className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Plus size={16} className="text-brand-400" /> Add a zone</h2>
        <div className="grid sm:grid-cols-[1fr_110px] gap-3">
          <input className="input-field" placeholder="Zone name (e.g. Girls Hostel)" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required />
          <input className="input-field" type="number" min="0" placeholder="Route order" value={form.route_order} onChange={e => setForm(v => ({ ...v, route_order: e.target.value }))} />
        </div>
        <textarea className="input-field resize-none" rows={2} placeholder="Optional delivery notes or area description" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
        <button disabled={saving} className="btn-primary text-sm"><Plus size={15} /> {saving ? 'Creating…' : 'Create Zone'}</button>
      </form>

      <section>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">Your zones</h2>
        {selectedZone && (
          <div className="card p-4 mb-4 border-brand-500/25 bg-gradient-to-br from-brand-500/10 to-surface-800">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><p className="text-[10px] uppercase tracking-wider text-brand-400 font-bold">Managing zone</p><h3 className="text-lg font-bold text-white mt-0.5">{selectedZone.name}</h3><p className="text-xs text-white/40 mt-1">Assign students to include them in this area’s delivery checklist.</p></div>
              <button onClick={() => setSelectedZone(null)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg"><X size={18} /></button>
            </div>
            {studentsLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div> : <>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select className="input-field flex-1 cursor-pointer" value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}>
                  <option value="">Select a student to add…</option>
                  {zoneStudents.available.map(student => <option key={student.id} value={student.id}>{student.name}{student.room_number ? ` · Room ${student.room_number}` : ''}{student.current_zone_name ? ` · currently ${student.current_zone_name}` : ''}</option>)}
                </select>
                <button onClick={assignStudent} disabled={!selectedStudentId || assigning} className="btn-primary justify-center text-sm"><UserPlus size={15} /> {assigning ? 'Adding…' : 'Add Student'}</button>
              </div>
              <div className="border-t border-white/5 pt-3"><p className="text-xs font-semibold text-white/50 mb-2">Assigned students ({zoneStudents.assigned.length})</p>
                {zoneStudents.assigned.length === 0 ? <p className="text-xs text-white/30 py-3 text-center">No students assigned to this zone yet.</p> : <div className="space-y-2">{zoneStudents.assigned.map(student => <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/15 border border-white/5"><div className="w-8 h-8 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center text-xs font-bold">{student.name?.[0]?.toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{student.name}</p><p className="text-[11px] text-white/40">{student.room_number ? `Room ${student.room_number} · ` : ''}{student.mobile}</p></div><button onClick={() => unassignStudent(student)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">Remove</button></div>)}</div>}
              </div>
            </>}
          </div>
        )}
        {loading ? <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>
          : zones.length === 0 ? <div className="card p-10 text-center text-white/30"><MapPinned size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">No delivery zones yet</p><p className="text-xs mt-1">Create a zone before assigning students.</p></div>
          : <div className="grid sm:grid-cols-2 gap-3">{zones.map(zone => (
            <button key={zone.id} onClick={() => loadZoneStudents(zone)} className={`card p-4 flex gap-3 items-start text-left transition-colors hover:border-brand-500/30 hover:bg-brand-500/5 ${selectedZone?.id === zone.id ? 'border-brand-500/40 bg-brand-500/10' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center"><MapPinned size={19} /></div>
              <div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-white text-sm truncate">{zone.name}</h3><span className="text-[10px] text-white/35">Route {zone.route_order}</span></div><p className="text-xs text-white/40 mt-1 min-h-4">{zone.description || 'No notes added'}</p><p className="text-xs text-brand-400 mt-2 flex items-center gap-1"><Users size={12} /> {zone.student_count} active student{zone.student_count === 1 ? '' : 's'}</p></div>
              <ChevronRight size={17} className="text-white/30 mt-2" />
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeZone(zone); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeZone(zone); } }} className="p-2 text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove zone"><Trash2 size={15} /></span>
            </button>
          ))}</div>}
      </section>
    </div>
  );
}
