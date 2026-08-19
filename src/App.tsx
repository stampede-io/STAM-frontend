import { Routes, Route } from "react-router-dom";
import SeatMapPage from "./pages/SeatMapPage";
import CheckoutPage from "./pages/CheckoutPage";

export default function App() {
  return (
    <Routes>
      <Route path="/shows/:showId/seats" element={<SeatMapPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
    </Routes>
  );
}
