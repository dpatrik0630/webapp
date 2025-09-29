import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "./axiosConfig.js";

const examplePlantId = 1;

const ControlPage = () => {
  const { id } = useParams();
  const parsedPlantId = parseInt(id, 10);

  const [settings, setSettings] = useState(null);
  const [exampleSettings, setExampleSettings] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [updateStatus, setUpdateStatus] = useState(null); // "success", "error", vagy null
  const [exampleStatus, setExampleStatus] = useState(null);

  // --- STABIL függvények (useCallback) ---
  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get(`/api/plant/${parsedPlantId}/power-adjustment`);
      setSettings(response.data);
      setNewPrice(response.data.price_threshold);
    } catch (error) {
      console.error("Hiba a szabályozási beállítások lekérésekor:", error);
    }
  }, [parsedPlantId]);

  const fetchExample = useCallback(async () => {
    try {
      const response = await api.get(`/api/plant/${examplePlantId}/power-adjustment`);
      setExampleSettings(response.data);
    } catch (error) {
      console.error("Hiba a példa erőmű lekérésekor:", error);
    }
  }, []);

  useEffect(() => {
    // első betöltéskor és plantId váltáskor
    fetchSettings();
    fetchExample();
  }, [fetchSettings, fetchExample]);

  const updateThreshold = async () => {
    try {
      await api.put(`/api/plant/${parsedPlantId}/power-adjustment`, {
        price_threshold: parseFloat(newPrice),
      });
      setUpdateStatus("success");
      fetchSettings(); // frissítés után újra lekéri
    } catch (error) {
      setUpdateStatus("error");
      console.error("Hiba az ár frissítésekor:", error);
    } finally {
      setTimeout(() => setUpdateStatus(null), 5000); // 5 mp után eltűnik
    }
  };

  const applyExamplePrice = async () => {
    if (!exampleSettings) return;
    try {
      await api.put(`/api/plant/${parsedPlantId}/power-adjustment`, {
        price_threshold: parseFloat(exampleSettings.price_threshold),
      });
      setExampleStatus("success");
      setNewPrice(exampleSettings.price_threshold);
      fetchSettings();
    } catch (error) {
      setExampleStatus("error");
      console.error("Hiba a példa ár alkalmazásakor:", error);
    } finally {
      setTimeout(() => setExampleStatus(null), 3000);
    }
  };

  if (!settings) return <p>Betöltés...</p>;

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Szabályozási beállítások</h1>

      <div className="mb-4">
        <p><strong>Jelenlegi küszöbár:</strong> {settings.price_threshold} €/MWh</p>
        <p><strong>Minimális teljesítménykorlát:</strong> {settings.min_power_limit} kW</p>
      </div>

      <div className="mb-6">
        <label className="block mb-2">Új küszöbár beállítása (€):</label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
          <button
            onClick={updateThreshold}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Frissítés
          </button>
          {updateStatus === "success" && <span className="text-green-600 font-medium">✔️ Sikeres</span>}
          {updateStatus === "error" && <span className="text-red-600 font-medium">❌ Hiba</span>}
        </div>
      </div>

      {exampleSettings && (
        <div className="mt-6">
          <p><strong>Példa erőmű küszöbára:</strong> {exampleSettings?.price_threshold} €/MWh</p>
          <div className="flex items-center space-x-3 mt-2">
            <button
              onClick={applyExamplePrice}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Alkalmazd ezt az értéket
            </button>
            {exampleStatus === "success" && <span className="text-green-600 font-medium">✔️ Sikeres</span>}
            {exampleStatus === "error" && <span className="text-red-600 font-medium">❌ Hiba</span>}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-500 mt-6">
        Az új küszöbár a következő óra 1. percében kerül alkalmazásra.
      </p>
    </div>
  );
};

export default ControlPage;
