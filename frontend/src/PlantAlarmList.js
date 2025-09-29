import React, { useEffect, useState, useCallback } from "react";
import api from "./axiosConfig.js";

const severityColors = {
  Major: "text-red-600",
  Minor: "text-yellow-600",
  Warning: "text-blue-600",
  Unknown: "text-gray-500",
};

const PlantAlarmList = ({ plantId }) => {
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [historyAlarms, setHistoryAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlarms = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get(`/api/plant/${plantId}/alarms/active`),
        api.get(`/api/plant/${plantId}/alarms/history`)
      ]);

      setActiveAlarms(activeRes.data);
      setHistoryAlarms(historyRes.data);
    } catch (err) {
      console.error("Hiba a riasztások lekérésekor:", err);
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2 text-red-600">🚨 Aktív riasztások</h2>

      {loading ? (
        <p>Betöltés...</p>
      ) : activeAlarms.length === 0 ? (
        <p className="text-green-600">Nincs aktív riasztás.</p>
      ) : (
        <table className="w-full text-sm mb-6 border">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">Riasztás</th>
              <th className="px-3 py-2">Kategória</th>
              <th className="px-3 py-2">Regiszter:Bit</th>
              <th className="px-3 py-2">Frissítve</th>
            </tr>
          </thead>
          <tbody>
            {activeAlarms.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-medium">{a.alarm_name}</td>
                <td className={`px-3 py-2 ${severityColors[a.severity] || "text-gray-600"}`}>{a.severity}</td>
                <td className="px-3 py-2">{a.register}:{a.bit}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(a.last_updated).toLocaleString("hu-HU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="text-xl font-semibold mb-2 mt-6 text-gray-800">📜 Előző riasztások</h2>

      {historyAlarms.length === 0 ? (
        <p className="text-gray-500">Nincs historikus riasztás.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">Riasztás</th>
              <th className="px-3 py-2">Típus</th>
              <th className="px-3 py-2">Kategória</th>
              <th className="px-3 py-2">Regiszter:Bit</th>
              <th className="px-3 py-2">Időbélyeg</th>
            </tr>
          </thead>
          <tbody>
            {historyAlarms.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-medium">{a.alarm_name}</td>
                <td className="px-3 py-2">{a.event_type === "ended" ? "Lezárt" : "Aktív"}</td>
                <td className={`px-3 py-2 ${severityColors[a.severity] || "text-gray-600"}`}>{a.severity}</td>
                <td className="px-3 py-2">{a.register}:{a.bit}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(a.timestamp).toLocaleString("hu-HU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PlantAlarmList;
