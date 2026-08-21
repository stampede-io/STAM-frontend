import { Routes, Route } from "react-router-dom";
import SeatMapPage from "./pages/SeatMapPage";
import CheckoutPage from "./pages/CheckoutPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import AuthHeader from "./components/AuthHeader";

export default function App() {
  return (
    <>
      <AuthHeader />
      <Routes>
        <Route path="/shows/:showId/seats" element={<SeatMapPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </>
  );
}
