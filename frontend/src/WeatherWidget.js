import React, { useEffect, useState } from "react";
import api from "./axiosConfig.js";

const WeatherWidget = ({ plantId }) => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const response = await api.get(`/api/weather/${plantId}`);
                setWeather(response.data);
            } catch (error) {
                console.error("Hiba az időjárás lekérésekor:", error);
            }
        };
        fetchWeather();
        const interval = setInterval(fetchWeather, 3600000);
        return () => clearInterval(interval);
    }, [plantId]);

    if (!weather) return null;

    return (
        <div className="flex items-center bg-white px-4 py-2 rounded-lg shadow min-w-[150px] h-12">
        <img src={weather.icon} alt="weather icon" className="w-6 h-6" />
        <span className="ml-2 text-sm whitespace-nowrap">{weather.temperature}°C, {weather.condition}</span>
        </div>
    );
};

export default WeatherWidget;
