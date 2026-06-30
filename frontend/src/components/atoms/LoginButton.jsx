import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';

function LoginButton() {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" onClick={() => loginWithRedirect()}>
      Log in
    </Button>
  );
}

export default LoginButton;
