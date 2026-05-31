import React from "react";
import {
  Lightbulb,
  Thermometer,
  Droplets,
  DoorOpen,
  Activity,
  Users,
  Play,
  BatteryLow,
  Cloud,
  ToggleRight,
  Blinds,
  ShieldAlert,
} from "lucide-react";
import type { HaState } from "../types";

// A read-only, one-page overview of the home assembled from current entity
// states. Many real HA setups don't set `device_class`, so classification is
// done by domain + unit + entity-name keywords (EN + NL) rather than relying
// on device_class. Only sections with data are rendered.

const ON = new Set(["on", "open", "home", "playing", "unlocked", "detected", "active"]);
const isOn = (s?: string | null) => ON.has(String(s).toLowerCase());

const name = (e: HaState) => (e.attributes?.friendly_name as string) || e.entity_id;
const dc = (e: HaState) => String(e.attributes?.device_class || "");
const unit = (e: HaState) => String(e.attributes?.unit_of_measurement || "");
const inDomain = (e: HaState, d: string) => e.entity_id.startsWith(d + ".");
const text = (e: HaState) => (e.entity_id + " " + name(e)).toLowerCase();
const num = (s?: string | null) => {
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
};

const RE = {
  // \btemp avoids substrings like "attempted"; "temperat" catches Dutch compounds.
  temp: /\btemp|temperat/,
  humidity: /humid|vocht/,
  battery: /batter|batterij|accu/,
  motion: /motion|beweg|occupan|presence|aanwezig|pir/,
  opening: /door|deur|window|raam|contact|opening|gate|garage|hek/,
  safety: /smoke|rook|co2|gas|leak|lek|water|moisture|sabotage|tamper|alarm/,
};
// Temperature uses °C/°F — NOT a bare ° (which is an angle, e.g. sun azimuth).
const isTempUnit = (u: string) => /°\s*[cf]/i.test(u);

export const Dashboard: React.FC<{
  states: HaState[];
  selected?: string[];
  labels?: Record<string, string>;
}> = ({ states, selected, labels }) => {
  if (!states || states.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">No entity data yet.</p>;
  }

  // If the user curated a dashboard set, restrict to it; otherwise auto-select.
  // Apply custom labels by overriding friendly_name so the rest of the grouping
  // (and name()) picks them up unchanged.
  const sel = selected && selected.length ? new Set(selected) : null;
  const view: HaState[] = states
    .filter((e) => !sel || sel.has(e.entity_id))
    .map((e) =>
      labels && labels[e.entity_id]
        ? { ...e, attributes: { ...(e.attributes || {}), friendly_name: labels[e.entity_id] } }
        : e,
    );

  if (view.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500">
        No entities selected for the dashboard. Pick some in Configuration → Home Assistant.
      </p>
    );
  }

  const lights = view.filter((e) => inDomain(e, "light"));
  const switches = view.filter((e) => inDomain(e, "switch"));
  const climate = view.filter((e) => inDomain(e, "climate"));
  const fans = view.filter((e) => inDomain(e, "fan"));
  const persons = view.filter((e) => inDomain(e, "person"));
  const media = view.filter((e) => inDomain(e, "media_player") && e.state !== "unavailable");
  const locks = view.filter((e) => inDomain(e, "lock"));
  const covers = view.filter((e) => inDomain(e, "cover"));
  const weather = view.find((e) => inDomain(e, "weather"));

  const sensors = view.filter((e) => inDomain(e, "sensor") && num(e.state) !== null);
  const tempSensors = sensors.filter((e) => isTempUnit(unit(e)) || (!unit(e) && RE.temp.test(text(e))));
  const humiditySensors = sensors.filter(
    (e) => dc(e) === "humidity" || (unit(e) === "%" && RE.humidity.test(text(e))),
  );
  const batteries = sensors.filter((e) => dc(e) === "battery" || (unit(e) === "%" && RE.battery.test(text(e))));
  const lowBatteries = batteries.filter((e) => (num(e.state) as number) <= 20);

  const bins = view.filter((e) => inDomain(e, "binary_sensor"));
  const motion = bins.filter((e) => RE.motion.test(text(e)));
  const openings = bins.filter((e) => RE.opening.test(text(e)));
  // Safety/alarm sensors (incl. battery alarms) — surface the active ones.
  const matched = new Set([...motion, ...openings]);
  const alerts = bins.filter((e) => !matched.has(e) && (RE.safety.test(text(e)) || RE.battery.test(text(e))));

  // ── Summary tiles ──────────────────────────────────────────────────────────
  const lightsOn = lights.filter((e) => isOn(e.state)).length;
  const openCount = [...openings, ...covers].filter((e) => isOn(e.state)).length;
  const motionActive = motion.filter((e) => isOn(e.state)).length;
  const alertsActive = alerts.filter((e) => isOn(e.state)).length;
  const peopleHome = persons.filter((e) => e.state === "home").length;
  const avgTemp =
    tempSensors.length > 0
      ? (tempSensors.reduce((a, e) => a + (num(e.state) as number), 0) / tempSensors.length).toFixed(1)
      : null;

  const tiles: { label: string; value: string; icon: React.ReactNode; tone?: string }[] = [];
  if (lights.length) tiles.push({ label: "Lights on", value: `${lightsOn}/${lights.length}`, icon: <Lightbulb size={18} />, tone: lightsOn ? "text-amber-400" : "text-gray-500" });
  if (avgTemp) tiles.push({ label: "Avg temperature", value: `${avgTemp}°`, icon: <Thermometer size={18} />, tone: "text-orange-400" });
  if (persons.length) tiles.push({ label: "People home", value: `${peopleHome}/${persons.length}`, icon: <Users size={18} />, tone: peopleHome ? "text-emerald-400" : "text-gray-500" });
  if (openings.length || covers.length) tiles.push({ label: "Open", value: `${openCount}`, icon: <DoorOpen size={18} />, tone: openCount ? "text-red-400" : "text-emerald-400" });
  if (alerts.length) tiles.push({ label: "Active alerts", value: `${alertsActive}`, icon: <ShieldAlert size={18} />, tone: alertsActive ? "text-red-400" : "text-emerald-400" });
  else if (motion.length) tiles.push({ label: "Motion", value: motionActive ? `${motionActive} active` : "clear", icon: <Activity size={18} />, tone: motionActive ? "text-yellow-400" : "text-gray-500" });

  const cap = <T,>(arr: T[], n = 24) => arr.slice(0, n);
  const more = <T,>(arr: T[], n = 24) => (arr.length > n ? arr.length - n : 0);

  return (
    <div className="space-y-6">
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <div className={`mb-1 ${t.tone || "text-gray-400"}`}>{t.icon}</div>
              <div className="text-xl font-semibold text-white">{t.value}</div>
              <div className="text-xs text-gray-500">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {weather && (
        <Card title="Weather" icon={<Cloud size={16} />}>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold capitalize text-white">{weather.state}</span>
            {num(weather.attributes?.temperature) !== null && (
              <span className="text-lg text-orange-400">{weather.attributes?.temperature}°</span>
            )}
            {num(weather.attributes?.humidity) !== null && (
              <span className="text-sm text-gray-400">{weather.attributes?.humidity}% humidity</span>
            )}
          </div>
        </Card>
      )}

      {climate.length > 0 && (
        <Card title="Climate" icon={<Thermometer size={16} />}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {climate.map((e) => (
              <div key={e.entity_id} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <div className="truncate text-xs text-gray-400">{name(e)}</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {num(e.attributes?.current_temperature) !== null ? `${e.attributes?.current_temperature}°` : e.state}
                </div>
                {num(e.attributes?.temperature) !== null && (
                  <div className="text-xs text-gray-500">target {e.attributes?.temperature}°</div>
                )}
                <div className="mt-1 text-xs capitalize text-emerald-400">{e.state}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(tempSensors.length > 0 || humiditySensors.length > 0) && (
        <Card title="Temperature & humidity" icon={<Droplets size={16} />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[...tempSensors, ...humiditySensors].map((e) => (
              <div key={e.entity_id} className="flex items-center justify-between rounded-lg bg-gray-950/50 px-3 py-2">
                <span className="truncate pr-2 text-xs text-gray-400">{name(e)}</span>
                <span className="flex-shrink-0 text-sm font-medium text-white">
                  {e.state}
                  {unit(e)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(lights.length > 0 || switches.length > 0 || fans.length > 0) && (
        <Card title="Lights, switches & fans" icon={<ToggleRight size={16} />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cap([...lights, ...fans, ...switches]).map((e) => (
              <div key={e.entity_id} className="flex items-center gap-2 rounded-lg bg-gray-950/50 px-3 py-2">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isOn(e.state) ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" : "bg-gray-700"}`} />
                <span className="truncate text-xs text-gray-300">{name(e)}</span>
              </div>
            ))}
          </div>
          {more([...lights, ...fans, ...switches]) > 0 && (
            <p className="mt-2 text-xs text-gray-600">+{more([...lights, ...fans, ...switches])} more</p>
          )}
        </Card>
      )}

      {(covers.length > 0 || openings.length > 0 || locks.length > 0) && (
        <Card title="Blinds, doors & windows" icon={<Blinds size={16} />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[...covers, ...openings, ...locks].map((e) => {
              const open = inDomain(e, "lock") ? e.state === "unlocked" : isOn(e.state);
              const label = inDomain(e, "lock") ? e.state : open ? "open" : "closed";
              return (
                <div key={e.entity_id} className="flex items-center justify-between rounded-lg bg-gray-950/50 px-3 py-2">
                  <span className="truncate pr-2 text-xs text-gray-300">{name(e)}</span>
                  <span className={`flex-shrink-0 text-xs font-medium capitalize ${open ? "text-red-400" : "text-emerald-400"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {motion.length > 0 && (
        <Card title="Motion" icon={<Activity size={16} />}>
          <div className="flex flex-wrap gap-2">
            {motion.map((e) => (
              <span
                key={e.entity_id}
                className={`rounded-full px-3 py-1 text-xs ${
                  isOn(e.state) ? "bg-yellow-900/30 text-yellow-300" : "bg-gray-800 text-gray-500"
                }`}
              >
                {name(e)} · {isOn(e.state) ? "active" : "clear"}
              </span>
            ))}
          </div>
        </Card>
      )}

      {alerts.length > 0 && (
        <Card title="Alerts & safety" icon={<ShieldAlert size={16} />}>
          {alertsActive === 0 ? (
            <p className="text-sm text-emerald-400">All clear — {alerts.length} monitored.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alerts
                .filter((e) => isOn(e.state))
                .map((e) => (
                  <span key={e.entity_id} className="rounded-full bg-red-900/30 px-3 py-1 text-xs text-red-300">
                    {name(e)}
                  </span>
                ))}
            </div>
          )}
        </Card>
      )}

      {persons.length > 0 && (
        <Card title="Presence" icon={<Users size={16} />}>
          <div className="flex flex-wrap gap-2">
            {persons.map((e) => (
              <span
                key={e.entity_id}
                className={`rounded-full px-3 py-1 text-xs ${
                  e.state === "home" ? "bg-emerald-900/30 text-emerald-300" : "bg-gray-800 text-gray-400"
                }`}
              >
                {name(e)} · {e.state}
              </span>
            ))}
          </div>
        </Card>
      )}

      {media.some((e) => e.state === "playing" || e.state === "paused") && (
        <Card title="Media" icon={<Play size={16} />}>
          <div className="space-y-1">
            {media
              .filter((e) => e.state === "playing" || e.state === "paused")
              .map((e) => (
                <div key={e.entity_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{name(e)}</span>
                  <span className="text-xs text-gray-500">
                    {(e.attributes?.media_title as string) || e.state}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {lowBatteries.length > 0 && (
        <Card title="Low batteries" icon={<BatteryLow size={16} />}>
          <div className="flex flex-wrap gap-2">
            {lowBatteries.map((e) => (
              <span key={e.entity_id} className="rounded-full bg-red-900/30 px-3 py-1 text-xs text-red-300">
                {name(e)} · {e.state}%
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {icon}
        {title}
      </h3>
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">{children}</div>
    </div>
  );
}
