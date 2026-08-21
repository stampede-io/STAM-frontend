import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(`Authorization failed: ${errorParam}`);
      return;
    }

    if (!code || !state) {
      setError("Missing authorization code or state");
      return;
    }

    handleCallback(code, state)
      .then(() => navigate("/", { replace: true }))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Login failed"),
      );
  }, [searchParams, handleCallback, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 text-lg mb-4" data-testid="auth-error">
          {error}
        </p>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Go to home
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg text-gray-500" data-testid="auth-loading">
        Completing login...
      </p>
    </div>
  );
}
