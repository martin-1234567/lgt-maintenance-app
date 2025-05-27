import React from 'react';
import { useMsal } from '@azure/msal-react';
import { Button, Box, Typography } from '@mui/material';

export const Login: React.FC = () => {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect({
      scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All']
    });
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Typography variant="h4" sx={{ mb: 4 }}>
        Application de Maintenance Ferroviaire
      </Typography>
      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={handleLogin}
        sx={{ fontSize: '1.1rem', py: 1.5, px: 4 }}
      >
        Se connecter avec Microsoft
      </Button>
    </Box>
  );
}; 