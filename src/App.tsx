import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import VehiclePlan from './components/VehiclePlan';
import { Vehicle } from './types';
import { systemsWithOperations } from './config/operations';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { msalConfig, loginRequest } from './config/operations';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LanguageIcon from '@mui/icons-material/Language';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import useMediaQuery from '@mui/material/useMediaQuery';

const vehicles: Vehicle[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Véhicule ${i + 1}`,
  planImage: i === 0 ? '/images/vehicle-1-test.png' : `/images/vehicle-${i + 1}.png`
}));

const msalInstance = new PublicClientApplication(msalConfig);

const translations = {
  fr: {
    title: "LGT Maintenance",
    subtitle: "Suivi de Maintenance des Véhicules",
    selectVehicle: "Sélectionner un véhicule",
    pleaseLogin: "Veuillez vous connecter pour accéder à l'application",
    login: "Se connecter",
    openProtocol: "Ouvrir le protocole SharePoint",
    openTrace: "Ouvrir la fiche de traçabilité",
    settings: "Réglages",
    language: "Langue",
    visual: "Visuel",
    lightMode: "Mode clair",
    darkMode: "Mode sombre",
    logout: "Se déconnecter",
    history: "Historique",
    addRecord: "Ajouter un enregistrement",
    system: "Système",
    operation: "Opération",
    date: "Date",
    comment: "Commentaire",
    actions: "Actions",
    noRecord: "Aucun enregistrement",
    edit: "Modifier",
    delete: "Supprimer",
    cancel: "Annuler",
    update: "Mettre à jour",
    save: "Enregistrer",
    confirmDeleteTitle: "Supprimer l'enregistrement",
    confirmDeleteText: "Voulez-vous vraiment supprimer cet enregistrement ?"
  },
  en: {
    title: "LGT Maintenance",
    subtitle: "Vehicle Maintenance Tracking",
    selectVehicle: "Select a vehicle",
    pleaseLogin: "Please log in to access the application",
    login: "Sign in",
    openProtocol: "Open SharePoint protocol",
    openTrace: "Open traceability form",
    settings: "Settings",
    language: "Language",
    visual: "Visual",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    logout: "Sign out",
    history: "History",
    addRecord: "Add a record",
    system: "System",
    operation: "Operation",
    date: "Date",
    comment: "Comment",
    actions: "Actions",
    noRecord: "No record",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    update: "Update",
    save: "Save",
    confirmDeleteTitle: "Delete record",
    confirmDeleteText: "Do you really want to delete this record?"
  }
};

// @ts-ignore
const requirePresentation = require.context('./assets/presentations', false, /\.(png|jpe?g|webp)$/);
function importAll(r: any): string[] {
  return r.keys().map((key: string) => r(key).default || r(key));
}
const presentationImages: string[] = importAll(requirePresentation);

function PresentationCarousel() {
  const [index, setIndex] = useState(0);
  const [available, setAvailable] = useState<number[]>([]);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    // Pré-chargement pour savoir quelles images existent
    let isMounted = true;
    Promise.all(
      presentationImages.map((src: string, i: number) =>
        new Promise<number | null>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve(i);
          img.onerror = () => resolve(null);
          img.src = src;
        })
      )
    ).then(results => {
      if (isMounted) {
        const valid = results.filter((i): i is number => i !== null);
        setAvailable(valid);
        setIndex(0); // reset index si images changent
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (available.length < 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % available.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [available]);

  if (available.length === 0) return null;
  const currentIdx = available[index % available.length];
  const src = presentationImages[currentIdx];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % available.length);
  };
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev - 1 + available.length) % available.length);
  };

  return (
    <Box
      sx={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', mt: 4, mb: 4 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 700 }}>
        <img
          src={src}
          alt={`Présentation ${currentIdx + 1}`}
          style={{
            maxWidth: '700px',
            width: '100%',
            maxHeight: '350px',
            objectFit: 'cover',
            borderRadius: 16,
            boxShadow: '0 4px 24px #0002',
            transition: 'opacity 0.5s',
            margin: '0 auto',
            display: 'block',
          }}
        />
        {hover && available.length > 1 && (
          <>
            <Box
              onClick={handlePrev}
              sx={{
                position: 'absolute',
                top: '50%',
                left: 12,
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 2,
                zIndex: 10,
                transition: 'background 0.2s',
                '&:hover': { background: 'rgba(58,125,184,0.95)', color: 'white' },
                fontSize: 28,
                color: '#3A7DB8',
                userSelect: 'none',
              }}
              title="Photo précédente"
            >
              &#8592;
            </Box>
            <Box
              onClick={handleNext}
              sx={{
                position: 'absolute',
                top: '50%',
                right: 12,
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 2,
                zIndex: 10,
                transition: 'background 0.2s',
                '&:hover': { background: 'rgba(58,125,184,0.95)', color: 'white' },
                fontSize: 28,
                color: '#3A7DB8',
                userSelect: 'none',
              }}
              title="Photo suivante"
            >
              &#8594;
            </Box>
          </>
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        {available.map((i, idx) => (
          <Box
            key={i}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: idx === (index % available.length) ? '#3A7DB8' : '#bbb',
              mx: 0.5,
              transition: 'background 0.3s',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function App() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { instance, accounts } = useMsal();

  // Gestion de la langue
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'fr');
  const t = translations[lang as 'fr' | 'en'];
  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    handleSettingsClose();
  };

  // Gestion du thème (clair/sombre)
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'light');
  const theme = createTheme({
    palette: {
      mode: themeMode as 'light' | 'dark',
      primary: {
        main: '#3A7DB8',
      },
      background: {
        default: themeMode === 'dark' ? '#181c24' : '#f5f5f5',
        paper: themeMode === 'dark' ? '#232a36' : '#fff',
      },
    },
  });
  const handleThemeChange = (mode: string) => {
    setThemeMode(mode);
    localStorage.setItem('themeMode', mode);
    handleVisualMenuClose();
  };

  // Pour le menu réglages
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [langMenuAnchor, setLangMenuAnchor] = useState<null | HTMLElement>(null);
  const langMenuOpen = Boolean(langMenuAnchor);
  const [visualMenuAnchor, setVisualMenuAnchor] = useState<null | HTMLElement>(null);
  const visualMenuOpen = Boolean(visualMenuAnchor);
  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleSettingsClose = () => {
    setAnchorEl(null);
    setLangMenuAnchor(null);
    setVisualMenuAnchor(null);
  };
  const handleLangMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLangMenuAnchor(event.currentTarget);
  };
  const handleLangMenuClose = () => {
    setLangMenuAnchor(null);
  };
  const handleVisualMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setVisualMenuAnchor(event.currentTarget);
  };
  const handleVisualMenuClose = () => {
    setVisualMenuAnchor(null);
  };

  const handleVehicleChange = (event: SelectChangeEvent<number>) => {
    const vehicle = vehicles.find(v => v.id === event.target.value);
    setSelectedVehicle(vehicle || null);
  };

  // Préparation du bloc à droite de l'en-tête
  const headerRight = (
    <Box sx={{ position: 'absolute', right: 32, top: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
      {(!accounts || accounts.length === 0) ? (
        <button
          style={{ padding: '10px 20px', fontSize: '1.1rem', cursor: 'pointer', borderRadius: 6, border: 'none', background: '#fff', color: '#3A7DB8', fontWeight: 'bold', boxShadow: '0 1px 4px #0002', marginRight: 8 }}
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          {t.login}
        </button>
      ) : (
        <Box sx={{ color: 'white', textAlign: 'right', fontSize: '1.1rem', fontWeight: 500, marginRight: 2 }}>
          <div>{accounts[0].name}</div>
          <div style={{ fontSize: '0.95rem', opacity: 0.85 }}>{accounts[0].username}</div>
        </Box>
      )}
      <IconButton onClick={handleSettingsClick} sx={{ color: 'white' }} size="large">
        <SettingsIcon fontSize="inherit" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleSettingsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleLangMenuOpen}>
          <ListItemIcon><LanguageIcon /></ListItemIcon>
          <ListItemText>{t.language}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleVisualMenuOpen}>{t.visual}</MenuItem>
        {accounts && accounts.length > 0 && (
          <MenuItem onClick={() => { instance.logoutRedirect(); handleSettingsClose(); }}>
            {t.logout}
          </MenuItem>
        )}
      </Menu>
      <Menu
        anchorEl={langMenuAnchor}
        open={langMenuOpen}
        onClose={handleLangMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem selected={lang === 'fr'} onClick={() => handleLangChange('fr')}>Français</MenuItem>
        <MenuItem selected={lang === 'en'} onClick={() => handleLangChange('en')}>English</MenuItem>
      </Menu>
      <Menu
        anchorEl={visualMenuAnchor}
        open={visualMenuOpen}
        onClose={handleVisualMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem selected={themeMode === 'light'} onClick={() => handleThemeChange('light')}>{t.lightMode}</MenuItem>
        <MenuItem selected={themeMode === 'dark'} onClick={() => handleThemeChange('dark')}>{t.darkMode}</MenuItem>
      </Menu>
    </Box>
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');

  // Couleur d'en-tête dynamique
  const headerBg = themeMode === 'dark' ? '#22334a' : '#3A7DB8';
  const headerText = themeMode === 'dark' ? '#fff' : '#fff';

  // Nouveau header responsive
  const header = (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        background: headerBg,
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1000,
        justifyContent: 'space-between',
        padding: isMobile ? '6px 8px' : '8px 24px',
        height: isMobile ? 60 : 100,
      }}
    >
      <img
        src="/images/logo-aff.png"
        alt="Logo AFF"
        style={{
          height: isMobile ? 32 : 60,
          marginRight: 8,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      <span
        style={{
          fontSize: isMobile ? '6vw' : '2.5rem',
          fontWeight: 'bold',
          letterSpacing: 2,
          textShadow: '1px 1px 8px #222',
          textAlign: 'center',
          width: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {t.title}
      </span>
      {isMobile ? (
        <>
          <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: 'white' }}>
            <MenuIcon />
          </IconButton>
          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          >
            <Box sx={{ width: 220, p: 2 }}>
              {headerRight}
            </Box>
          </Drawer>
        </>
      ) : (
        <Box sx={{ minWidth: 220 }}>{headerRight}</Box>
      )}
    </header>
  );

  if (!accounts || accounts.length === 0) {
    return (
      <>
        {header}
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Container maxWidth="md" sx={{ mt: isMobile ? 8 : 14, px: { xs: 1, sm: 2 }, mb: 4 }}>
            <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
                {t.pleaseLogin}
              </Typography>
            </Box>
            <PresentationCarousel />
          </Container>
        </ThemeProvider>
      </>
    );
  }

  return (
    <>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {header}
        <Container maxWidth="md" sx={{ mt: isMobile ? 8 : 14, px: { xs: 1, sm: 2 }, mb: 4 }}>
          <Box sx={{ my: 4 }}>
            <Typography variant={isMobile ? 'h6' : 'h4'} component="h1" gutterBottom sx={{ fontWeight: 600, textAlign: isMobile ? 'center' : 'left' }}>
              {t.subtitle}
            </Typography>
            <VehiclePlan systems={systemsWithOperations} />
          </Box>
        </Container>
      </ThemeProvider>
    </>
  );
}

function AppWrapper() {
  return (
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
}

export default AppWrapper;
