import React from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { Login } from './components/Login';
import MainTabs from './components/MainTabs';
import { systems } from './data/systems';

function App() {
  return (
    <div className="App">
      <AuthenticatedTemplate>
        <MainTabs systems={systems} />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;