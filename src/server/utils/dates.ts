export function parseDateToISO(input: any): string {
  if (!input) return new Date().toISOString();

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date().toISOString() : input.toISOString();
  }

  const str = String(input).trim();

  // GDELT format: YYYYMMDDHHMMSS or YYYYMMDD
  if (/^\d{14}$/.test(str)) {
    const year = str.slice(0, 4);
    const month = str.slice(4, 6);
    const day = str.slice(6, 8);
    const hour = str.slice(8, 10);
    const min = str.slice(10, 12);
    const sec = str.slice(12, 14);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
  }

  if (/^\d{8}$/.test(str)) {
    const year = str.slice(0, 4);
    const month = str.slice(4, 6);
    const day = str.slice(6, 8);
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  // Unix timestamp (seconds or milliseconds)
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const ms = str.length === 10 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    // Sanitize future timestamp anomalies (e.g., erroneous years like 2077 or 2121 from metadata)
    if (parsed.getTime() > Date.now() + 7 * 86400000) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

export function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';

  const diffMs = Date.now() - d.getTime();
  // Future dates or timezone skew tolerance
  if (diffMs < 0) return 'Just now';

  const elapsedSec = Math.floor(diffMs / 1000);
  if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `${elapsedDays}d ago`;
  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return `${elapsedMonths}mo ago`;
  const elapsedYears = Math.floor(elapsedDays / 365);
  return `${elapsedYears}y ago`;
}
