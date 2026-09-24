import { Auth0Provider } from '@auth0/auth0-react';
import type { ComponentType } from 'react';

import LoginButton from './LoginButton';

function withAuth0(Story: ComponentType) {
  const StoryComponent = Story;

  return (
    <Auth0Provider
      domain="storybook.example.auth0.com"
      clientId="storybook-client-id"
      authorizationParams={{ redirect_uri: window.location.origin }}
    >
      <StoryComponent />
    </Auth0Provider>
  );
}

export default {
  component: LoginButton,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
  decorators: [withAuth0],
};

export const Default = {};
