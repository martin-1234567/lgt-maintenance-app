import React from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { Login } from './components/Login';
import VehiclePlan from './components/VehiclePlan';
import { systems } from './data/systems';

function App() {
  return (
    <div className="App">
      <AuthenticatedTemplate>
        <VehiclePlan systems={systems} />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;