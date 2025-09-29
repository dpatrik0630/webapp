import React, { useEffect, useState, useCallback } from "react";
import { NavLink, useParams } from "react-router-dom";
import api from "./axiosConfig.js";
import "./PlantDetails.css";
import LogoutButton from "./LogoutButton.js";
import WeatherWidget from "./WeatherWidget.js";
import MobileMenu from "./MobileMenu.js";
import AlarmSummaryIcons from "./AlarmSummaryIcons.js";
import { Bar, BarChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import { DateTime } from "luxon";

const PlantDetails = () => {
  const { id } = useParams();
  const parsedPlantId = parseInt(id, 10);

  const [meterData, setMeterData] = useState(null);
  const [productionData, setProductionData] = useState([]);
  // const [consumptionData, setConsumptionData] = useState([]); // nem használt
  const [lastUpdated, setLastUpdated] = useState(null);
  // const [loading, setLoading] = useState(false); // nem használt
  const [loggerData, setLoggerData] = useState(null);
  const [plantName, setPlantName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [controlEnabled, setControlEnabled] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dailyYieldData, setDailyYieldData] = useState([]);
  // const [hoveredKey, setHoveredKey] = useState(null); // nem használt

  useEffect(() => {
    console.log("ProductionData:", productionData);
  }, [productionData]);

  const units = {
    voltage: "V",
    curr: "A",
    power: "kW",
    reactive_power: "kVAR",
    total_energy_yield: "kWh",
    today_yield: "kWh"
  };

  function ProdChartTooltip({ active, payload, label }) {
    if (!active || !payload || typeof label !== "number") return null;

    const prod = payload.find(p => p.dataKey === "activePower")?.value ?? null;
    const consNeg = payload.find(p => p.dataKey === "consumptionNeg")?.value ?? null;
    const cons = consNeg == null ? null : Math.abs(consNeg);

    const timeStr = DateTime.fromMillis(label, { zone: "Europe/Budapest" }).toFormat("yyyy-MM-dd HH:mm");
    const fmt = v => (v == null ? "—" : Number(v).toFixed(3) + " kW");

    return (
      <div style={{
        background: "#fff",
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 4px 14px rgba(0,0,0,.08)",
        minWidth: 220
      }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{timeStr}</div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#52c41a", display: "inline-block" }} />
            <span>PV output</span>
          </div>
          <strong>{fmt(prod)}</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#ff4d4f", display: "inline-block" }} />
            <span>Consumption power</span>
          </div>
          <strong>{fmt(cons)}</strong>
        </div>
      </div>
    );
  }

  // --- useCallback: stabil referenciák ---

  const fetchPlantName = useCallback(async () => {
    try {
      const response = await api.get("/api/plants");
      const current = response.data.find(p => p.id === parsedPlantId);
      setPlantName(current?.name || "Plant Details");
    } catch (error) {
      console.error("Hiba az erőmű nevének lekérésekor:", error);
    }
  }, [parsedPlantId]);

  const fetchPlantControlStatus = useCallback(async () => {
    try {
      const response = await api.get(`/api/plant/${parsedPlantId}/power-adjustment`);
      setControlEnabled(Boolean(response.data.price_control_enabled));
    } catch (error) {
      console.error("Hiba a szabályozási státusz lekérésekor:", error);
    }
  }, [parsedPlantId]);

  const fetchMeterData = useCallback(() => {
    api.get(`/api/plant/${parsedPlantId}/meter-data`)
      .then(response => {
        const { id, plant_id, timestamp, ...filteredData } = response.data;
        setMeterData(filteredData);
      })
      .catch(error => console.error("Hiba a meter adatok lekérésekor:", error));
  }, [parsedPlantId]);

  const fetchLoggerData = useCallback(() => {
    api.get(`/api/plant/${parsedPlantId}/logger-data`)
      .then(response => {
        const { id, plant_id, timestamp, ...filteredData } = response.data;
        setLoggerData(filteredData);
      })
      .catch(error => console.error("Hiba a logger adatok lekérésekor:", error));
  }, [parsedPlantId]);

  // --- időbélyegek ---
  const toMillisLogger = (iso) => {
    const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone("Europe/Budapest");
    const rounded = dt.second >= 30 ? dt.plus({ minutes: 1 }) : dt;
    return rounded.set({ second: 0, millisecond: 0 }).toMillis();
  };
  const toMillisMeter = (iso) => {
    const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone("Europe/Budapest");
    const rounded = dt.second >= 30 ? dt.plus({ minutes: 1 }) : dt;
    return rounded.set({ second: 0, millisecond: 0 }).toMillis();
  };

  const fetchProductionData = useCallback(async () => {
    try {
      const { data: result } = await api.get(
        `/api/plant/${parsedPlantId}/production-data`,
        { params: { date: selectedDate.toISOString().split("T")[0] } }
      );

      const productionRaw = result?.production ?? [];
      const consumptionRaw = result?.consumption ?? [];

      const prodMap = new Map(
        productionRaw.map((p) => [
          toMillisLogger(p.timestamp),
          Math.max(0, Number(p.active_power) || 0),
        ])
      );

      // import + / export −
      const gridMap = new Map(
        consumptionRaw.map((c) => [
          toMillisMeter(c.timestamp),
          Number(c.active_power) || 0,
        ])
      );

      const allMinutes = new Set([...prodMap.keys(), ...gridMap.keys()]);
      const merged = Array.from(allMinutes)
        .filter((ms) => Number.isFinite(ms))
        .sort((a, b) => a - b)
        .map((ms) => {
          let prodKW = prodMap.get(ms);
          let gridKW = gridMap.get(ms);

          if (gridKW == null) gridKW = gridMap.get(ms - 60_000) ?? gridMap.get(ms + 60_000);
          if (prodKW == null) prodKW = prodMap.get(ms - 60_000) ?? prodMap.get(ms + 60_000);

          const consumption =
            prodKW == null && gridKW == null
              ? null
              : Math.max(0, (prodKW ?? 0) + (gridKW ?? 0));

          return {
            timestampRaw: ms,
            activePower: prodKW ?? null,
            consumption,
            consumptionNeg: consumption == null ? null : -consumption,
          };
        });

      const latestIso = [...productionRaw, ...consumptionRaw]
        .map((x) => x.timestamp)
        .filter(Boolean)
        .sort()
        .pop();
      setLastUpdated(
        latestIso
          ? DateTime.fromISO(latestIso, { zone: "utc" })
              .setZone("Europe/Budapest")
              .toFormat("yyyy-MM-dd HH:mm")
          : null
      );

      setProductionData(merged);
    } catch (err) {
      console.error("Error fetching production data:", err);
      setProductionData([]);
    }
  }, [parsedPlantId, selectedDate]);

  const getMonthRange = (offset) => {
    const start = DateTime.now().setZone("Europe/Budapest").startOf("month").plus({ months: offset });
    const end = start.endOf("month");
    return {
      startDate: start.toFormat("yyyy-MM-dd"),
      endDate: end.toFormat("yyyy-MM-dd"),
      label: start.toFormat("yyyy MMMM")
    };
  };

  const fetchDailyYield = useCallback(async () => {
    const { startDate, endDate } = getMonthRange(monthOffset);
    try {
      const response = await api.get(`/api/plant/${parsedPlantId}/daily-yield-range`, {
        params: { start_date: startDate, end_date: endDate }
      });

      const data = response.data;

      const start = DateTime.fromISO(startDate);
      const end = DateTime.fromISO(endDate);
      const daysInMonth = end.diff(start, "days").days + 1;

      const filledData = Array.from({ length: daysInMonth }).map((_, index) => {
        const current = start.plus({ days: index }).toFormat("yyyy-MM-dd");
        const found = data.find(d => d.date === current);
        return {
          date: current,
          yield: found ? found.yield : 0
        };
      });

      setDailyYieldData(filledData);
    } catch (error) {
      console.error("Hiba a napi hozam lekérésekor:", error);
    }
  }, [parsedPlantId, monthOffset]);

  useEffect(() => {
    fetchDailyYield();
  }, [fetchDailyYield]);

  // ---- napkezdés/napvége (BP) ----
  const startOfDayMs = DateTime.fromJSDate(selectedDate, { zone: "Europe/Budapest" })
    .startOf("day")
    .toMillis();
  const endOfDayMs = DateTime.fromJSDate(selectedDate, { zone: "Europe/Budapest" })
    .endOf("day")
    .toMillis();

  const maxAbs = Math.max(
    0,
    ...productionData.map(d => Math.abs(d.activePower ?? 0)),
    ...productionData.map(d => Math.abs(d.consumption ?? 0))
  );
  const niceY = Math.max(100, Math.ceil(maxAbs / 100) * 100);

  const generateHourlyTicks = () => {
    const base = DateTime.fromMillis(startOfDayMs, { zone: "Europe/Budapest" });
    return Array.from({ length: 25 }, (_, i) => base.plus({ hours: i }).toMillis());
  };

  // fő effekt: adatlekérések + intervallumok
  useEffect(() => {
    fetchMeterData();
    fetchProductionData();
    fetchLoggerData();
    fetchPlantName();
    fetchPlantControlStatus();

    const loggerInterval = setInterval(fetchLoggerData, 60000);
    const meterInterval = setInterval(fetchMeterData, 60000);
    const prodInterval = setInterval(fetchProductionData, 60000);

    return () => {
      clearInterval(meterInterval);
      clearInterval(prodInterval);
      clearInterval(loggerInterval);
    };
  }, [
    fetchMeterData,
    fetchProductionData,
    fetchLoggerData,
    fetchPlantName,
    fetchPlantControlStatus
  ]);

  // A régi, duplikált useEffect, ami újra-definiálta a fetchPlantName-et, ELTÁVOLÍTVA

  return (
    <div className="container">
      {/* Fejléc + Menü */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
        {/* Bal oldal: név + navigáció */}
        <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-6">
          <h1 className="text-3xl font-bold">{plantName} Details</h1>
          <NavLink
            to={`/`}
            className="ml-1 px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
          >
            ⟵ Erőművek
          </NavLink>

          {/* Inverterek gomb */}
          <NavLink
            to={`/plant/${id}/inverters`}
            className="ml-1 px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
          >
            Inverterek
          </NavLink>

          {controlEnabled && (
            <NavLink
              to={`/plant/${id}/control`}
              className="ml-1 px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
            >
              Szabályozás
            </NavLink>
          )}

          <NavLink
            to={`/plant/${id}/alarms/active`}
            className="ml-1 px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
          >
            Riasztások
          </NavLink>
        </div>

        {/* Jobb oldal: időjárás + logout + mobilmenü */}
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <AlarmSummaryIcons plantId={parsedPlantId} />
          <WeatherWidget plantId={parsedPlantId} />
          <div className="md:hidden">
            <MobileMenu id={id} />
          </div>
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Tartalom: Meter + Production */}
      <div className="data-container">
        <div className="data-box">
          <h2>Meter Data</h2>
          {meterData ? (
            <ul>
              {Object.entries(meterData).map(([key, value]) => {
                const formattedKey = key === "active_power"
                  ? "consumption"
                  : key.replace(/_/g, " ");
                const unitKey = Object.keys(units).find(u => key.includes(u));
                const unit = units[unitKey] || "";

                return (
                  <li key={key}>
                    <strong>{formattedKey}:</strong>{" "}
                    {typeof value === "number" ? value.toFixed(3) : value} {unit}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Loading meter data...</p>
          )}

          {loggerData ? (
            <ul>
              {Object.entries(loggerData).map(([key, value]) => {
                const formattedKey = key.replace(/_/g, " ");
                const unitKey = Object.keys(units).find(u => key.includes(u));
                const unit = units[unitKey] || "";

                return (
                  <li key={key}>
                    <strong>{formattedKey}:</strong>{" "}
                    {typeof value === "number" ? value.toFixed(3) : value} {unit}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Loading logger data...</p>
          )}
        </div>

        <div className="data-box">
          <h2>Production Data</h2>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            className="border p-2 rounded mb-2"
            maxDate={new Date()}
          />
          <p>
            <strong>Last updated:</strong> {lastUpdated || "N/A"}
          </p>

          <div className="production-chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={productionData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis
                  dataKey="timestampRaw"
                  type="number"
                  domain={[startOfDayMs, endOfDayMs]}
                  ticks={generateHourlyTicks()}
                  tickFormatter={(ms) =>
                    DateTime.fromMillis(ms, { zone: "Europe/Budapest" }).toFormat("HH:mm")
                  }
                  tickMargin={8}
                />
                <YAxis
                  domain={[-niceY, niceY]}
                  tickFormatter={(v) => Math.abs(v).toFixed(0)}
                />

                <Tooltip content={<ProdChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Legend />

                {/* Zöld: termelés */}
                <Line
                  type="monotone"
                  dataKey="activePower"
                  stroke="#52c41a"
                  name="Active Power (kW)"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />

                {/* Piros: fogyasztás (negatívban) */}
                <Line
                  type="monotone"
                  dataKey="consumptionNeg"
                  stroke="#ff4d4f"
                  name="Consumption (kW)"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="data-box">
          <h2 className="text-xl font-semibold mb-2">Napi termelés (today yield)</h2>

          <div className="flex items-center justify-between mb-2">
            <button
              className="px-3 py-1 border rounded bg-white hover:bg-gray-100"
              onClick={() => setMonthOffset(monthOffset - 1)}
            >
              ← Előző hónap
            </button>
            <span className="font-semibold">{getMonthRange(monthOffset).label}</span>
            <button
              className="px-3 py-1 border rounded bg-white hover:bg-gray-100"
              onClick={() => setMonthOffset(monthOffset + 1)}
              disabled={monthOffset >= 0}
            >
              Következő hónap →
            </button>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyYieldData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, (dataMax) => Math.ceil(dataMax / 100) * 100]} />
              <Tooltip
                formatter={(value) => `${value.toFixed(2)} kWh`}
                labelFormatter={(label) => `Dátum: ${label}`}
              />
              <Legend />
              <Bar
                dataKey="yield"
                fill="#82ca9d"
                name="Napi termelés"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default PlantDetails;
