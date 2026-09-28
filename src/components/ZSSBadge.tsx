import type { Rating } from '../types/signal';

const COLORS: Record<Rating, string> = {
  ELITE: 'var(--success)',
  OPTIMAL: 'var(--primary)',
  MODERATE: 'var(--warning)',
  WEAK: 'var(--danger)',
};

export default function ZSSBadge({ rating, zss }: { rating: Rating; zss: number }) {
  return (
    <span className="zss-badge" style={{ borderColor: COLORS[rating], color: COLORS[rating] }}>
      {rating} · {zss.toFixed(2)}
    </span>
  );
}
