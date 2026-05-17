import { Globe } from 'lucide-react';
import { useEdgeStore } from '../../store/edgeStore';
import { getColoCity } from '../../utils/coloMap';

// Shows which Cloudflare edge datacenter you're connected to.
// Small, subtle, sits in the header or control bar area.
export function EdgeRegionBadge() {
  const { colo, loaded } = useEdgeStore();

  if (!loaded || !colo) return null;

  const city = getColoCity(colo);

  return (
    <span
      className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium"
      style={{
        background: 'rgba(0,255,149,0.06)',
        border: '1px solid rgba(0,255,149,0.15)',
        color: 'rgba(240,244,255,0.55)',
      }}
      title={`Connected to Cloudflare ${city} (${colo.toUpperCase()})`}
    >
      <Globe size={10} color="#00FF95" />
      <span style={{ color: '#00FF95' }}>{city}</span>
      <span style={{ color: 'rgba(240,244,255,0.3)' }}>({colo.toUpperCase()})</span>
    </span>
  );
}
