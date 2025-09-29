import React, { useEffect, useState } from "react";
import api from "./axiosConfig.js";
import LogoutButton from "./LogoutButton.js";
import { useNavigate } from "react-router-dom";

function PlantList() {
  const [plants, setPlants] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api.get("/api/plants") /*"http://localhost:8000/api/plants"*/
      .then(response => setPlants(response.data))
      .catch(error => console.error("Hiba az erőművek lekérésekor:", error));
  }, []);

  const filteredPlants = plants.filter(plant =>
    plant.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 sm:px-8 py-4">

      {/* Fejléc: cím + logout */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Solar Plants</h1>
        <button onClick={() => navigate("/string-health")} style={{
          background:"#4f46e5", color:"#fff", padding:"8px 14px",
          border:"none", borderRadius:8, cursor:"pointer"
        }}>
          String Health
        </button>
        <LogoutButton />
      </div>

      {/* Kereső */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search for a plant..."
          className="w-full sm:w-64 p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Rács */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
        {filteredPlants.map((plant) => {
          const now = new Date();
          const lastUpdated = plant.last_updated ? new Date(plant.last_updated) : null;

          const minutesAgo = lastUpdated
            ? (now.getTime() - lastUpdated.getTime()) / 60000
            : Infinity;

          const isRecent = minutesAgo < 5;

          const cardColor = isRecent
            ? "bg-green-100" // halványzöld
            : "bg-red-100";  // halványpiros

          return (
            <div
              key={plant.id}
              className={`${cardColor} shadow rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => navigate(`/plant/${plant.id}`)}
            >
              <h2 className="text-xl font-semibold text-black-700">{plant.name}</h2>
              <p className="text-xs text-gray-400 mt-1">
                Last updated:{" "}
                {lastUpdated
                  ? lastUpdated.toLocaleString("hu-HU", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "n/a"}
              </p>
            </div>
          );
        })}

      </div>

    </div>

  );
};

export default PlantList;
