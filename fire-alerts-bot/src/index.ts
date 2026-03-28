import 'dotenv/config';
import { fetchActiveIncidents, isFireIncident, type AnepcIncident } from './anepc.js';
import { distanceKm } from './geo.js';
import { sendTelegram } from './telegram.js';

// ── Config ───────────────────────────────────────────────────────────

const MONITOR_LAT = parseFloat(process.env.MONITOR_LAT ?? '39.8228');
const MONITOR_LNG = parseFloat(process.env.MONITOR_LNG ?? '-7.4931');
const RADIUS_KM = parseFloat(process.env.MONITOR_RADIUS_KM ?? '50');
const POLL_INTERVAL_MS = (parseFloat(process.env.POLL_INTERVAL_MIN ?? '3') * 60_000);

// ── State ────────────────────────────────────────────────────────────

interface TrackedFire {
  statusId: number;
  statusName: string;
  personnel: number;
  terrainVehicles: number;
  aerialMeans: number;
  distKm: number;
}

const tracked = new Map<string, TrackedFire>();

// ── ANEPC status codes ───────────────────────────────────────────────
// 1 = Despacho de 1º Alerta
// 3 = Em Curso (Ongoing)
// 5 = Em Resolução (Being resolved)
// 7 = Conclusão (Concluded)
// 8 = Vigilância (Monitoring)
// 9 = Encerrada (Closed)

const STATUS_EMOJI: Record<number, string> = {
  1: '🚨',  // first alert dispatch
  3: '🔥',  // ongoing
  5: '🧯',  // in resolution
  7: '✅',  // concluded
  8: '👀',  // monitoring
  9: '🔒',  // closed
};

function statusEmoji(id: number): string {
  return STATUS_EMOJI[id] ?? '❓';
}

// ── Alert formatting ─────────────────────────────────────────────────

function formatNewFireAlert(fire: AnepcIncident, dist: number): string {
  return [
    `🔥 NEW FIRE NEARBY`,
    ``,
    `📍 ${fire.locality || fire.freguesia}, ${fire.freguesia}`,
    `📌 ${fire.concelho}, ${fire.district}`,
    `📏 ${dist.toFixed(1)} km away`,
    `🕐 Started: ${fire.dateTime}`,
    `🏷️ Type: ${fire.natureShort || fire.natureCode}`,
    `${statusEmoji(fire.statusId)} Status: ${fire.statusName}`,
    `👨‍🚒 Personnel: ${fire.personnel} | 🚒 Vehicles: ${fire.terrainVehicles} | ✈️ Aerial: ${fire.aerialMeans}`,
    ``,
    `📎 ID: ${fire.number}`,
  ].join('\n');
}

function formatUpdateAlert(fire: AnepcIncident, dist: number, changes: string[]): string {
  return [
    `⚠️ FIRE UPDATE`,
    ``,
    `📍 ${fire.locality || fire.freguesia}, ${fire.freguesia}`,
    `📌 ${fire.concelho}, ${fire.district}`,
    `📏 ${dist.toFixed(1)} km away`,
    ``,
    ...changes.map((c) => `  → ${c}`),
    ``,
    `${statusEmoji(fire.statusId)} Status: ${fire.statusName}`,
    `👨‍🚒 Personnel: ${fire.personnel} | 🚒 Vehicles: ${fire.terrainVehicles} | ✈️ Aerial: ${fire.aerialMeans}`,
    ``,
    `📎 ID: ${fire.number}`,
  ].join('\n');
}

function formatResolvedAlert(fire: AnepcIncident, dist: number): string {
  return [
    `${statusEmoji(fire.statusId)} FIRE RESOLVED`,
    ``,
    `📍 ${fire.locality || fire.freguesia}, ${fire.freguesia}`,
    `📌 ${fire.concelho}, ${fire.district}`,
    `📏 ${dist.toFixed(1)} km away`,
    `${statusEmoji(fire.statusId)} Status: ${fire.statusName}`,
    ``,
    `📎 ID: ${fire.number}`,
  ].join('\n');
}

// ── Change detection ─────────────────────────────────────────────────

function detectChanges(prev: TrackedFire, fire: AnepcIncident): string[] {
  const changes: string[] = [];

  if (prev.statusId !== fire.statusId) {
    changes.push(`Status: ${prev.statusName} → ${fire.statusName}`);
  }

  if (fire.personnel > prev.personnel && fire.personnel >= prev.personnel + 5) {
    changes.push(`Personnel: ${prev.personnel} → ${fire.personnel}`);
  }

  if (fire.terrainVehicles > prev.terrainVehicles && fire.terrainVehicles >= prev.terrainVehicles + 2) {
    changes.push(`Vehicles: ${prev.terrainVehicles} → ${fire.terrainVehicles}`);
  }

  if (fire.aerialMeans > prev.aerialMeans) {
    changes.push(`Aerial: ${prev.aerialMeans} → ${fire.aerialMeans}`);
  }

  return changes;
}

// Statuses that mean the fire is no longer active
const RESOLVED_STATUSES = new Set([7, 8, 9]); // Conclusão, Vigilância, Encerrada

// ── Main poll loop ───────────────────────────────────────────────────

async function poll() {
  try {
    const allIncidents = await fetchActiveIncidents();
    const fires = allIncidents.filter(isFireIncident);

    const nearbyFires = fires
      .map((f) => ({
        fire: f,
        dist: distanceKm(MONITOR_LAT, MONITOR_LNG, f.lat, f.lng),
      }))
      .filter(({ dist, fire }) => dist <= RADIUS_KM && fire.lat !== 0 && fire.lng !== 0);

    const currentIds = new Set<string>();

    for (const { fire, dist } of nearbyFires) {
      currentIds.add(fire.id);
      const prev = tracked.get(fire.id);

      if (!prev) {
        // New fire - only alert if it's active (not already concluded)
        if (!RESOLVED_STATUSES.has(fire.statusId)) {
          console.log(`[new] Fire ${fire.id} at ${dist.toFixed(1)}km - ${fire.concelho}`);
          await sendTelegram(formatNewFireAlert(fire, dist));
        }
        tracked.set(fire.id, {
          statusId: fire.statusId,
          statusName: fire.statusName,
          personnel: fire.personnel,
          terrainVehicles: fire.terrainVehicles,
          aerialMeans: fire.aerialMeans,
          distKm: dist,
        });
        continue;
      }

      // Check if it just resolved
      if (!RESOLVED_STATUSES.has(prev.statusId) && RESOLVED_STATUSES.has(fire.statusId)) {
        console.log(`[resolved] Fire ${fire.id} - ${fire.statusName}`);
        await sendTelegram(formatResolvedAlert(fire, dist));
        tracked.set(fire.id, {
          statusId: fire.statusId,
          statusName: fire.statusName,
          personnel: fire.personnel,
          terrainVehicles: fire.terrainVehicles,
          aerialMeans: fire.aerialMeans,
          distKm: dist,
        });
        continue;
      }

      // Check for significant changes
      const changes = detectChanges(prev, fire);
      if (changes.length > 0) {
        console.log(`[update] Fire ${fire.id}: ${changes.join(', ')}`);
        await sendTelegram(formatUpdateAlert(fire, dist, changes));
      }

      // Always update tracking state
      tracked.set(fire.id, {
        statusId: fire.statusId,
        statusName: fire.statusName,
        personnel: fire.personnel,
        terrainVehicles: fire.terrainVehicles,
        aerialMeans: fire.aerialMeans,
        distKm: dist,
      });
    }

    // Clean up fires that are no longer in the active list
    for (const id of tracked.keys()) {
      if (!currentIds.has(id)) {
        tracked.delete(id);
      }
    }

    console.log(
      `[poll] ${new Date().toISOString()} — ${fires.length} fires total, ${nearbyFires.length} within ${RADIUS_KM}km`
    );
  } catch (err) {
    console.error('[poll] Error:', err);
  }
}

// ── Startup ──────────────────────────────────────────────────────────

console.log(`🔥 Fire Alerts Bot starting`);
console.log(`📍 Monitoring: ${MONITOR_LAT}, ${MONITOR_LNG} (radius: ${RADIUS_KM}km)`);
console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS / 60_000} minutes`);
console.log(`📱 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'NOT configured'}`);
console.log('');

// Run immediately, then on interval
poll();
setInterval(poll, POLL_INTERVAL_MS);
