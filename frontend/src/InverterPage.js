import React, { useEffect, useState, useCallback } from "react";
import { NavLink, useParams } from "react-router-dom";
import api from "./axiosConfig.js";
import LogoutButton from "./LogoutButton.js";
import WeatherWidget from "./WeatherWidget.js";
import "./PlantDetails.css";
import MobileMenu from "./MobileMenu.js";
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer } from "recharts";

const InverterPage = () => {
  const { id } = useParams();
  const parsedPlantId = parseInt(id, 10);

  const [plantName, setPlantName] = useState("");

  const [inverterData, setInverterData] = useState([]);
  const [weeklyAvgData, setWeeklyAvgData] = useState([]);
  const [threshold] = useState(null);
  const [maxStringCount, setMaxStringCount] = useState(12);
  const [inverterPerformance, setInverterPerformance] = useState([]);


  const fetchInverterData = useCallback(() => {
    api.get(`/api/plant/${parsedPlantId}/inverter-data`)
      .then(response => {
        setInverterData(response.data);
        if (response.data.length > 0) {
          setMaxStringCount(response.data[0].max_string_count);
        }
      })
      .catch(error => console.error("Hiba az inverter adatok lekérése közben:", error));
  }, [parsedPlantId]);

  const fetchWeeklyAvgData = useCallback(() => {
    api.get(`/api/plant/${parsedPlantId}/weekly-avg`)
      .then(response => setWeeklyAvgData(response.data))
      .catch(error => console.error("Error fetching weekly average data:", error));
  }, [parsedPlantId]);

  const fetchInverterPerformance = useCallback(() => {
    api.get(`/api/plant/${parsedPlantId}/inverter-performance`)
      .then(response => setInverterPerformance(response.data))
      .catch(error => console.error("Hiba az inverter teljesítmény lekérésekor:", error));
  }, [parsedPlantId]);


  const getDeviationClass = (stringId, voltage, current) => {
    if (!threshold || !weeklyAvgData.length) return "";

    const avg = weeklyAvgData.find(item => item.string_number === stringId);
    if (!avg) return "";

    const avgPower = avg.weekly_avg_power;
    const currentPower = voltage * current;
    const deviation = Math.abs(((currentPower - avgPower) / avgPower) * 100);

    if (threshold === 2.5 && deviation >= 2.5 && deviation < 5) return "highlight-red-2-5";
    if (threshold === 5 && deviation >= 5 && deviation < 10) return "highlight-red-5";
    if (threshold === 10 && deviation >= 10) return "highlight-red-10";
    if (threshold === "low" && deviation < 2.5) return deviation === 0 ? "highlight-green-zero" : "highlight-green-low";

    return "";
  };

  useEffect(() => {
    fetchInverterData();
    fetchWeeklyAvgData();
    fetchInverterPerformance();

    const fetchPlantName = async () => {
      try {
        const response = await api.get("/api/plants");
        const current = response.data.find(p => p.id === parsedPlantId);
        setPlantName(current?.name || "Plant");
      } catch (error) {
        console.error("Hiba az erőmű nevének lekérésekor:", error);
      }
    };
    fetchPlantName();

    console.log("Inverter performance adat:", inverterPerformance);

    const inverterInterval = setInterval(fetchInverterData, 60000);
    const inverterPerformanceInterval = setInterval(fetchInverterPerformance, 60000);

    return () => {
      clearInterval(inverterInterval);
      clearInterval(inverterPerformanceInterval);
    };
  }, [parsedPlantId, fetchInverterData, fetchWeeklyAvgData, fetchInverterPerformance, inverterPerformance]);

  return (
    <div className="container">
      {/* Fejléc */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
        {/* Bal oldal: cím + visszagomb */}
        <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-6">
          <h1 className="text-3xl font-bold">{plantName} – Inverterek</h1>

          <NavLink
            to={`/plant/${id}`}
            className="ml-1 px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
>
            ⟵ Áttekintés
          </NavLink>
        </div>

        {/* Jobb oldal: időjárás + logout + mobilmenü */}
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <WeatherWidget plantId={parsedPlantId} />

          <div className="md:hidden">
            <MobileMenu id={id} />
          </div>

          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Inverter Performance Chart */}
      <div className="inverter-performance-chart">
        <h3>Inverter Performance</h3>
        <ResponsiveContainer width="100%" height={40 * inverterPerformance.length}>
          <BarChart
            layout="vertical"
            data={inverterPerformance}
            margin={{ top: 20, right: 50, left: 120, bottom: 20 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(tick) => `${tick}%`}
            />
            <YAxis
              dataKey="inverter_name"
              type="category"
              tick={{ fontSize: 12 }}
              width={160}
            />
            <Bar
              dataKey="percent"
              barSize={22}
              label={({ x, y, width, height, value, index }) => {
                const inverter = inverterPerformance[index];
                if (!inverter || typeof inverter.percent !== 'number' || typeof inverter.active_power !== 'number') return null;

                const percent = inverter.percent;
                const labelText = `${inverter.active_power.toFixed(2)} kW — ${percent.toFixed(2)}%`;

                const isLow = percent < 10;

                return (
                  <text
                    x={isLow ? x + width + 10 : x + width - 10}
                    y={y + height / 2 + 4}
                    fill="#000"
                    fontSize={11}
                    fontWeight="bold"
                    textAnchor={isLow ? "start" : "end"}
                  >
                    {labelText}
                  </text>
                );
              }}
            >
              {
                inverterPerformance.map((entry, index) => {
                  const maxPower = Math.max(...inverterPerformance.map(inv => inv.active_power));
                  const powerDiffPercent = ((maxPower - entry.active_power) / maxPower) * 100;

                  let fillColor = '#22c55e'; // zöld
                  if (powerDiffPercent >= 10 && powerDiffPercent <= 50) {
                    fillColor = '#facc15'; // sárga
                  } else if (powerDiffPercent > 50) {
                    fillColor = '#ef4444'; // piros
                  }

                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })
              }
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="inverter-section">
        <div className="button-group">
          {/* Itt később lehetnek szűrőgombok */}
        </div>

        <div className="inverter-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Inverter</th>
                {Array.from({ length: maxStringCount }, (_, i) => (
                  <th key={i} colSpan="2">String {i + 1}</th>
                ))}
              </tr>
              <tr>
                <th></th>
                {Array.from({ length: maxStringCount }, (_, i) => (
                  <React.Fragment key={i}>
                    <th>Voltage (V)</th>
                    <th>Current (A)</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {inverterData.map((inverter) => (
                <tr key={inverter.inverter_id}>
                  <td className="sticky-column">{inverter.inverter_name || inverter.inverter_id}</td>
                  {Array.from({ length: maxStringCount }, (_, i) => {
                    const voltage = inverter[`string_${i + 1}_v`] || "-";
                    const current = inverter[`string_${i + 1}_a`] || "-";
                    const deviationClass = getDeviationClass(i + 1, voltage, current);

                    return (
                      <React.Fragment key={i}>
                        <td className={deviationClass}>{voltage}</td>
                        <td className={deviationClass}>{current}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );

};

export default InverterPage;
