import { useAuth0 } from '@auth0/auth0-react';

function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) {
    return <button className="btn btn--sm" disabled>Loading...</button>;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <button className="btn btn--sm" onClick={() => loginWithRedirect()}>
      Log in
    </button>
  );
}

export default LoginButton;
