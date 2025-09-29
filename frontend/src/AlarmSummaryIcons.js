import React, { useEffect, useState } from "react";
import api from "./axiosConfig.js";

const ICONS = {
  Major: "❗",
  Minor: "🟡",
  Warning: "⚠️",
};

const SEVERITY_ORDER = ["Major", "Minor", "Warning"];

const AlarmSummaryIcons = ({ plantId }) => {
  const [summary, setSummary] = useState({});

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get(`/api/plant/${plantId}/alarms/summary`);
        setSummary(res.data);
      } catch (err) {
        console.error("Hiba az alarm summary lekérésekor:", err);
      }
    };
    fetchSummary();
  }, [plantId]);

  return (
    <div className="flex items-center space-x-4 text-sm text-gray-800">
      {SEVERITY_ORDER.map((sev) => (
        <div key={sev} className="flex items-center space-x-1">
          <span
            className="text-xl"
            title={
              sev === "Major"
                ? "Súlyos riasztás"
                : sev === "Minor"
                ? "Kisebb riasztás"
                : "Figyelmeztetés"
            }
          >
            {ICONS[sev]}
          </span>
          <span className="font-semibold">{summary[sev] || 0}</span>
        </div>
      ))}
    </div>
  );
};

export default AlarmSummaryIcons;
