import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PlantList from "./PlantList.js";
import PlantDetails from "./PlantDetails.js";
import Login from "./Login.js";
import PrivateRoute from "./PrivateRoute.js";
import InverterPage from "./InverterPage.js";
import ControlPage from "./ControlPage.js";
import StringHealthPage from "./StringHealthPage.js";
import PlantAlarmListWrapper from "./PlantAlarmListWrapper.js";
import "./App.css";


function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                    <PrivateRoute>
                        <PlantList />
                    </PrivateRoute>
                } />
                <Route path="/plant/:id" element={
                    <PrivateRoute>
                        <PlantDetails />
                    </PrivateRoute>
                } />
                <Route path="/plant/:id/inverters" element={
                    <PrivateRoute>
                        <InverterPage />
                    </PrivateRoute>
                } />
                <Route path="/plant/:id/control" element={
                    <PrivateRoute>
                        <ControlPage />
                    </PrivateRoute>
                } />
                <Route path="/string-health" element={
                    <PrivateRoute>
                        <StringHealthPage />
                    </PrivateRoute>
                } />

                <Route path="/plant/:plantId/alarms/active" element={<PlantAlarmListWrapper />} />
            </Routes>
        </Router>
    );
}

export default App;
