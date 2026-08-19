import { Routes, Route } from "react-router-dom";
import SeatMapPage from "./pages/SeatMapPage";

export default function App() {
  return (
    <Routes>
      <Route path="/shows/:showId/seats" element={<SeatMapPage />} />
    </Routes>
  );
}
