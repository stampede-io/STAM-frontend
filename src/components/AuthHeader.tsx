import { useAuth } from "../auth/useAuth";

export default function AuthHeader() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) return null;

  return (
    <header className="flex justify-end px-4 py-2 bg-white border-b border-gray-200">
      {isAuthenticated ? (
        <button
          onClick={logout}
          data-testid="logout-button"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Log out
        </button>
      ) : (
        <button
          onClick={login}
          data-testid="login-button"
          className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700"
        >
          Log in
        </button>
      )}
    </header>
  );
}
