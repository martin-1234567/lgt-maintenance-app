import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import VehiclePlan from './VehiclePlan';
import { System } from '../types';

interface MainTabsProps {
  systems: System[];
}

const MainTabs: React.FC<MainTabsProps> = ({ systems }) => {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        centered
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          backgroundColor: '#f5f5f5',
          '& .MuiTab-root': {
            fontSize: '1.1rem',
            fontWeight: 500,
            minWidth: 120,
            padding: '12px 24px'
          }
        }}
      >
        <Tab label="Accueil" />
        <Tab label="Consistances" />
        <Tab label="Historique" />
        <Tab label="Paramètres" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && <VehiclePlan systems={systems} />}
        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            <h2>Gestion des Consistances</h2>
            {/* Contenu de l'onglet Consistances */}
          </Box>
        )}
        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            <h2>Historique Global</h2>
            {/* Contenu de l'onglet Historique */}
          </Box>
        )}
        {tab === 3 && (
          <Box sx={{ p: 3 }}>
            <h2>Paramètres</h2>
            {/* Contenu de l'onglet Paramètres */}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MainTabs; 