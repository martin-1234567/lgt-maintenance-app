import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  Divider
} from '@mui/material';
import { Vehicle, System, MaintenanceRecord } from '../types/index';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMsal } from '@azure/msal-react';
import { MaintenanceService } from '../services/maintenanceService';
import { useMsalAuthentication } from '@azure/msal-react';
import * as XLSX from 'xlsx';
import SearchIcon from '@mui/icons-material/Search';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { fr } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import useMediaQuery from '@mui/material/useMediaQuery';
import RefreshIcon from '@mui/icons-material/Refresh';
import { pdfjs, Document, Page } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';
import PullToRefresh from 'react-pull-to-refresh';
import { useSwipeable } from 'react-swipeable';
import PDFFormViewer from './PDFFormViewer';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?worker';
import CloseIcon from '@mui/icons-material/Close';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.js`;

interface VehiclePlanProps {
  vehicle: Vehicle;
  systems: System[];
  t: {
    history: string;
    addRecord: string;
    system: string;
    operation: string;
    date: string;
    comment: string;
    actions: string;
    noRecord: string;
    edit: string;
    delete: string;
    cancel: string;
    update: string;
    save: string;
    confirmDeleteTitle: string;
    confirmDeleteText: string;
  };
}

interface PdfViewerSharepointProps {
  operationCode: string;
  type: 'protocole' | 'tracabilite';
  onBack: () => void;
  setStatus?: (status: 'en cours' | 'terminé') => void;
  currentStatus?: 'non commencé' | 'en cours' | 'terminé';
  setTab?: (tab: number) => void;
  systems: System[];
  allowStatusChange?: boolean;
  recordId?: string;
}
function PdfViewerSharepoint({ operationCode, type, onBack, setStatus, currentStatus, setTab, systems, allowStatusChange, recordId }: PdfViewerSharepointProps) {
  const { instance, accounts } = useMsal();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [excelUrl, setExcelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');
  const [saving, setSaving] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null); // Ajout du token
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const maintenanceService = MaintenanceService.getInstance();

  // Fonction pour formater le nom du système
  const formatSystemName = (name: string): string => {
    return name.replace(/\./g, '-');
  };

  const getAccessToken = async () => {
    if (!accounts || accounts.length === 0) {
      throw new Error("Aucun compte connecté");
    }
    const response = await instance.acquireTokenSilent({
      scopes: [
        'Files.Read.All',
        'Sites.Read.All',
        'Files.ReadWrite.All',
        'Sites.ReadWrite.All'
      ],
      account: accounts[0],
    });
    console.log('AccessToken:', response.accessToken);
    return response.accessToken;
  };

  const handleStatusChange = async (newStatus: 'en cours' | 'terminé'): Promise<void> => {
    if (type !== 'tracabilite') return;
    
    // Action immédiate
    if (setStatus) {
      setStatus(newStatus);
    }
    
    // Action asynchrone en arrière-plan
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      setError('Erreur lors de la mise à jour du statut');
    } finally {
      setSaving(false);
    }
  };

  const fetchUrl = async () => {
    setLoading(true);
    setError('');
    setObjectUrl(null);
    setExcelUrl(null);
    try {
      const token = await getAccessToken();
      const SHAREPOINT_SITE_ID = 'arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d';
      const SHAREPOINT_DRIVE_ID = 'b!b3ZCPc57jkuS4HAnKuK5XvMhps8TUDxDnRQ8UZ8Ru426aMo8mBCBTrOSBU5EbQE4';
      const SHAREPOINT_FOLDER_ID = '01UIJT6YLQOURHAQCBSRB2FWB5PX6OZRJG';
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${SHAREPOINT_FOLDER_ID}/children`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      console.log('Fichiers trouvés dans ESSAI OUTILS :', data.value);
      data.value.forEach((f: any) => console.log('Nom du fichier trouvé :', f.name));
      let file;
      if (type === 'protocole') {
        file = (data.value as any[]).find((f: any) =>
          f.parentReference && f.parentReference.path && f.parentReference.path.includes('ESSAI OUTILS') &&
          f.name.startsWith(operationCode + '-') && f.name.endsWith('.pdf') && f.name.toLowerCase().includes('protocole')
        );
        if (!file) {
          file = (data.value as any[]).find((f: any) =>
            f.parentReference && f.parentReference.path && f.parentReference.path.includes('ESSAI OUTILS') &&
            f.name.startsWith(operationCode + '-') && f.name.endsWith('.pdf')
          );
        }
        if (file) {
          console.log('Fichier SharePoint trouvé (protocole) :', file);
          if (file['@microsoft.graph.downloadUrl']) {
            setObjectUrl(file['@microsoft.graph.downloadUrl']);
            console.log('Affichage du PDF via PDF.js :', file['@microsoft.graph.downloadUrl']);
          } else {
            setError('Impossible d\'afficher le PDF');
          }
        } else {
          setError('protocole non disponible');
        }
      } else {
        const system = systems.find((s: System) => s.operations.some((o: { id: string }) => o.id === operationCode));
        if (!system) {
          setError('Système non trouvé');
          return;
        }
        const formattedSystemName = formatSystemName(system.name);
        const traceabilityFileName = `FT-LGT-${formattedSystemName}.pdf`;
        console.log('Nom attendu (traceabilityFileName) :', traceabilityFileName);
        file = (data.value as any[]).find((f: any) =>
          f.parentReference && f.parentReference.path && f.parentReference.path.includes('ESSAI OUTILS') &&
          f.name.trim().toLowerCase() === traceabilityFileName.trim().toLowerCase()
        );
        if (file) {
          console.log('Fichier SharePoint trouvé (traçabilité) :', file);
          if (file['@microsoft.graph.downloadUrl']) {
            setObjectUrl(file['@microsoft.graph.downloadUrl']);
            console.log('Affichage du PDF via PDF.js :', file['@microsoft.graph.downloadUrl']);
          } else {
            setError('Impossible d\'afficher le PDF');
          }
        } else {
          setError('fiche de traçabilité non disponible');
        }
      }
    } catch (e) {
      console.error('Erreur lors de la récupération du document:', e);
      setError('Erreur lors de la récupération du document.');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Récupère le token d'accès dès le montage
    getAccessToken().then(token => setAccessToken(token)).catch(() => setAccessToken(null));
    fetchUrl();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line
  }, [operationCode, type]);

  useEffect(() => {
    if (excelUrl) {
      console.log('Tentative d\'affichage de l\'Excel avec l\'URL:', excelUrl);
    }
  }, [excelUrl]);

  return (
    <Dialog open onClose={onBack} maxWidth="xl" fullWidth fullScreen={isMobile} PaperProps={isMobile ? { sx: { m: 0, p: 0, borderRadius: 0 } } : {}}>
      {isMobile ? (
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
          <Button onClick={onBack} variant="outlined" sx={{ fontSize: '1.1rem', minWidth: 100 }}>Fermer</Button>
        </Box>
      ) : (
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={onBack} variant="outlined">Fermer</Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {type === 'tracabilite' && allowStatusChange && (
                <>
                  <Button
                    variant={currentStatus === 'en cours' ? 'contained' : 'outlined'}
                    color="warning"
                    onClick={() => handleStatusChange('en cours')}
                    disabled={saving}
                  >
                    {saving ? 'Sauvegarde...' : 'Sauvegarder (en cours)'}
                  </Button>
                  <Button
                    variant={currentStatus === 'terminé' ? 'contained' : 'outlined'}
                    color="success"
                    onClick={() => handleStatusChange('terminé')}
                    disabled={saving}
                  >
                    {saving ? 'Sauvegarde...' : 'Terminer'}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </DialogTitle>
      )}
      <DialogContent sx={{ p: 0, ...(isMobile && { px: 0, py: 0, m: 0 }) }}>
        {loading && (
          <Box sx={{ color: 'text.primary', fontSize: 24, textAlign: 'center', mt: 10 }}>Chargement…</Box>
        )}
        {!loading && (type === 'tracabilite' || type === 'protocole') && (
          objectUrl ? (
            <PDFFormViewer
              url={objectUrl}
              status={currentStatus === 'terminé' ? 'terminé' : 'en cours'}
              onStatusChange={async (_newStatus) => {}}
              saving={saving}
              onSave={async (data, newStatus) => {
                if (data && objectUrl) {
                  const fileId = objectUrl.split('/items/')[1]?.split('/')[0];
                  if (fileId) {
                    const maintenanceService = MaintenanceService.getInstance();
                    await maintenanceService.updatePdfFile(fileId, data);
                  }
                }
              }}
              onBack={onBack}
              type={type}
            />
          ) : (
            <Box sx={{ color: 'red', fontWeight: 'bold', fontSize: '1.1rem', mt: 10, textAlign: 'center' }}>
              {type === 'tracabilite' ? 'fiche de traçabilité non disponible' : 'protocole non disponible'}
            </Box>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ViewerModalProps {
  url: string;
  onBack: () => void;
  recordId?: string;
  setStatus?: (status: 'en cours' | 'terminé') => void;
  currentStatus?: 'non commencé' | 'en cours' | 'terminé';
}
function ViewerModal({ url, onBack, recordId, setStatus, currentStatus }: ViewerModalProps) {
  return (
    <Dialog open onClose={onBack} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Button onClick={onBack} variant="outlined">Fermer</Button>
        {setStatus && (
          <span style={{ float: 'right', display: 'flex', gap: 8 }}>
            <Button
              variant={currentStatus === 'en cours' ? 'contained' : 'outlined'}
              color="warning"
              onClick={() => setStatus('en cours')}
              sx={{ ml: 2 }}
            >
              Sauvegarder (en cours)
            </Button>
            <Button
              variant={currentStatus === 'terminé' ? 'contained' : 'outlined'}
              color="success"
              onClick={() => setStatus('terminé')}
              sx={{ ml: 1 }}
            >
              Terminer
            </Button>
          </span>
        )}
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <EditablePDFViewer
          url={url}
          fileId={url ? url.split('/items/')[1]?.split('/')[0] : undefined}
          status={currentStatus === 'terminé' ? 'terminé' : 'en cours'}
          onStatusChange={() => {}}
          saving={false}
          onSave={async () => {}}
          onBack={onBack}
        />
      </DialogContent>
    </Dialog>
  );
}

const CONSISTANCES = [
  { id: 'IS710', name: 'IS710' }
];

// Liste des véhicules (à adapter selon ta structure)
const VEHICLES: Vehicle[] = [
  { id: 1, name: 'Véhicule 1', planImage: '' },
  { id: 2, name: 'Véhicule 2', planImage: '' },
  { id: 3, name: 'Véhicule 3', planImage: '' },
  { id: 4, name: 'Véhicule 4', planImage: '' },
  { id: 5, name: 'Véhicule 5', planImage: '' },
  { id: 6, name: 'Véhicule 6', planImage: '' },
  { id: 7, name: 'Véhicule 7', planImage: '' },
  { id: 8, name: 'Véhicule 8', planImage: '' },
  { id: 9, name: 'Véhicule 9', planImage: '' },
  { id: 10, name: 'Véhicule 10', planImage: '' },
  { id: 11, name: 'Véhicule 11', planImage: '' },
  { id: 12, name: 'Véhicule 12', planImage: '' },
];

// Ajout du type pour un système local
interface LocalSystem {
  id: string;
  name: string;
  operations: { id: string; name: string }[];
}

// Système de traduction (français/anglais)
const translations = {
  fr: {
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
    confirmDeleteTitle: "Confirmation de suppression",
    confirmDeleteText: "Voulez-vous vraiment supprimer cet enregistrement ?",
    chooseConsistency: "Choisissez une consistance",
    chooseVehicle: "Choisissez un véhicule",
    currentConsistency: "Consistance actuelle",
    addSystem: "Ajouter un système",
    addOperation: "Ajouter opération",
    add: "Ajouter",
    removeSystem: "Supprimer système",
    removeOperation: "Supprimer",
    startMaintenance: "Commencer la maintenance",
    openProtocol: "Ouvrir le protocole SharePoint",
    openTraceability: "Ouvrir la fiche de traçabilité",
    protocolUnavailable: "protocole non disponible",
    traceabilityUnavailable: "fiche de traçabilité non disponible",
    loading: "Chargement…",
    back: "← Retour",
    user: "Utilisateur",
    status: "Statut de la fiche de traçabilité",
    allStatus: "Tous les statuts",
    notStarted: "Non commencé",
    inProgress: "En cours",
    done: "Terminé"
  },
  en: {
    history: "History",
    addRecord: "Add record",
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
    confirmDeleteTitle: "Delete confirmation",
    confirmDeleteText: "Do you really want to delete this record?",
    chooseConsistency: "Choose a consistency",
    chooseVehicle: "Choose a vehicle",
    currentConsistency: "Current consistency",
    addSystem: "Add system",
    addOperation: "Add operation",
    add: "Add",
    removeSystem: "Remove system",
    removeOperation: "Remove",
    startMaintenance: "Start maintenance",
    openProtocol: "Open SharePoint protocol",
    openTraceability: "Open traceability sheet",
    protocolUnavailable: "protocol not available",
    traceabilityUnavailable: "traceability sheet not available",
    loading: "Loading…",
    back: "← Back",
    user: "User",
    status: "Traceability sheet status",
    allStatus: "All status",
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done"
  }
};

// Ajout du type pour un enregistrement en attente
interface PendingRecord extends MaintenanceRecord {
  consistency: string;
  vehicleId: number;
  systemName: string;
  operationName: string;
}

const VehiclePlan: React.FC<{ systems: System[] }> = ({ systems }) => {
  const { instance, accounts } = useMsal();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedConsistency, setSelectedConsistency] = useState<string>('');
  const [recordsByConsistency, setRecordsByConsistency] = useState<{
    [cons: string]: { [vehicleId: number]: MaintenanceRecord[] }
  }>({});
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, recordId: string|null}>({open: false, recordId: null});
  const [showPdf, setShowPdf] = useState<{operationId: string|null, type?: 'protocole'|'tracabilite', allowStatusChange?: boolean, recordId?: string}>({operationId: null, type: undefined});
  const [showViewer, setShowViewer] = useState<{url: string|null}>({url: null});
  const [filters, setFilters] = useState({
    system: '',
    operation: '',
    date: '',
    comment: '',
    status: '',
    user: ''
  });
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({
    system: null,
    operation: null,
    date: null,
    comment: null,
    status: null,
    user: null
  });
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [addConsDialogOpen, setAddConsDialogOpen] = useState(false);
  const [newConsName, setNewConsName] = useState('');
  const [consistencies, setConsistencies] = useState<string[]>(() => {
    const saved = localStorage.getItem('consistencies');
    return saved ? JSON.parse(saved) : ['IS710'];
  });
  const [localSystems, setLocalSystems] = useState<{ [cons: string]: LocalSystem[] }>(() => {
    const saved = localStorage.getItem('localSystems');
    return saved ? JSON.parse(saved) : {};
  });
  const [sysName, setSysName] = useState('');
  const [opName, setOpName] = useState('');
  const [ops, setOps] = useState<{ id: string; name: string }[]>([]);
  const [showCustomSysForm, setShowCustomSysForm] = useState(false);
  const [newSystems, setNewSystems] = useState<
    { id: string, name: string, operations: { id: string, name: string }[] }[]
  >([]);
  const [showAddSystemForm, setShowAddSystemForm] = useState(false);
  const [newSysName, setNewSysName] = useState('');
  const [newSysOps, setNewSysOps] = useState<{ id: string; name: string }[]>([]);
  const [newOpName, setNewOpName] = useState('');
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const t = translations[lang];
  const isMobile = useMediaQuery('(max-width:600px)');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Gestion des événements tactiles (swipe horizontal)
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setTouchStartX(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // On ne gère plus le pull-to-refresh, donc rien ici
  };

  const handleTouchEnd = async (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY !== null && touchStartX !== null) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Gestion du swipe horizontal uniquement
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (selectedVehicle && selectedConsistency) {
          const currentIndex = VEHICLES.findIndex(v => v.id === selectedVehicle.id);
          if (deltaX > 0 && currentIndex > 0) {
            // Swipe droite -> véhicule précédent
            setSelectedVehicle(VEHICLES[currentIndex - 1]);
          } else if (deltaX < 0 && currentIndex < VEHICLES.length - 1) {
            // Swipe gauche -> véhicule suivant
            setSelectedVehicle(VEHICLES[currentIndex + 1]);
          }
        }
      }
    }
    setTouchStartY(null);
    setTouchStartX(null);
  };

  const maintenanceService = MaintenanceService.getInstance();
  const userName = accounts && accounts[0] ? (accounts[0].name || accounts[0].username) : 'Inconnu';

  // Réinitialisation du formulaire
  const resetForm = () => {
    setEditingRecord(null);
    setSelectedSystem('');
    setSelectedOperation('');
    setComment('');
  };

  // Gestion de l'édition d'un enregistrement
  const handleEditRecord = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setSelectedSystem(record.systemId);
    setSelectedOperation(record.operationId);
    setComment(record.comment || '');
    setTab(1);
  };

  // Fonction de mise à jour locale des enregistrements
  const updateLocalRecords = (consistency: string, vehicleId: number, updatedRecords: MaintenanceRecord[]) => {
    setRecordsByConsistency(prev => ({
      ...prev,
      [consistency]: {
        ...prev[consistency],
        [vehicleId]: updatedRecords
      }
    }));
  };

  // Fonction pour mettre à jour les enregistrements
  const updateRecords = async (consistency: string, vehicleId: number, updatedRecords: MaintenanceRecord[]) => {
    try {
      console.log('[DEBUG] Début sauvegarde SharePoint', {consistency, vehicleId, updatedRecords});
      if (!accounts || accounts.length === 0) {
        throw new Error("Aucun compte connecté");
      }
      const response = await instance.acquireTokenSilent({
        scopes: [
          'Files.Read.All',
          'Sites.Read.All',
          'Files.ReadWrite.All',
          'Sites.ReadWrite.All'
        ],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      await maintenanceService.saveMaintenanceRecords(consistency, vehicleId, updatedRecords);
      setRecordsByConsistency(prev => ({
        ...prev,
        [consistency]: {
          ...prev[consistency],
          [vehicleId]: updatedRecords
        }
      }));
      console.log('[DEBUG] Sauvegarde SharePoint terminée', {consistency, vehicleId});
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde des enregistrements');
      console.error('[DEBUG] Erreur de sauvegarde SharePoint', err);
    }
  };

  // Fonction pour charger les enregistrements
  const loadRecords = async (consistency: string, vehicleId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Les données sont toujours rechargées depuis SharePoint
      if (!accounts || accounts.length === 0) {
        throw new Error("Aucun compte connecté");
      }
      const response = await instance.acquireTokenSilent({
        scopes: [
          'Files.Read.All',
          'Sites.Read.All',
          'Files.ReadWrite.All',
          'Sites.ReadWrite.All'
        ],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      let records = await maintenanceService.getMaintenanceRecords(consistency, vehicleId);
      setRecordsByConsistency(prev => ({
        ...prev,
        [consistency]: {
          ...prev[consistency],
          [vehicleId]: records
        }
      }));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des enregistrements');
    } finally {
      setLoading(false);
    }
  };

  // Mise à jour de handleAddOrEdit pour utiliser pendingStatus si présent
  const handleAddOrEdit = async () => {
    if (selectedSystem && selectedOperation && selectedVehicle && selectedConsistency) {
      let updatedRecords: MaintenanceRecord[];
      if (editingRecord) {
        updatedRecords = currentRecords.map(record =>
          record.id === editingRecord.id 
            ? { ...record, systemId: selectedSystem, operationId: selectedOperation, comment, user: userName, status: record.status }
            : record
        );
      } else {
        let pdfUrl: string | undefined = undefined;
        try {
          const token = await instance.acquireTokenSilent({
            scopes: [
              'Files.Read.All',
              'Sites.Read.All',
              'Files.ReadWrite.All',
              'Sites.ReadWrite.All'
            ],
            account: accounts[0],
          });
          maintenanceService.setAccessToken(token.accessToken);
          // Recherche du fichier de traçabilité de base
          const SHAREPOINT_SITE_ID = 'arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d';
          const SHAREPOINT_DRIVE_ID = 'b!b3ZCPc57jkuS4HAnKuK5XvMhps8TUDxDnRQ8UZ8Ru426aMo8mBCBTrOSBU5EbQE4';
          const SHAREPOINT_FOLDER_ID = '01UIJT6YLQOURHAQCBSRB2FWB5PX6OZRJG';
          const system = systems.find((s: System) => s.id === selectedSystem);
          const formattedSystemName = system ? system.name.replace(/\./g, '-') : selectedSystem;
          const traceabilityFileName = `FT-LGT-${formattedSystemName}.pdf`;
          // Récupérer la liste des fichiers du dossier
          const res = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${SHAREPOINT_FOLDER_ID}/children`,
            { headers: { Authorization: `Bearer ${token.accessToken}` } }
          );
          const data = await res.json();
          const file = (data.value as any[]).find((f: any) =>
            f.parentReference && f.parentReference.path && f.parentReference.path.includes('ESSAI OUTILS') &&
            f.name.trim().toLowerCase() === traceabilityFileName.trim().toLowerCase()
          );
          if (file) {
            // Générer le nom de la copie : <NomFichierBase>-YYYYMMDDHHmmss.pdf
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const baseFileName = file.name.replace('.pdf', '');
            const newFileName = `${baseFileName}-${dateStr}.pdf`;
            // Copier le fichier
            const copiedFile = await maintenanceService.copyFile(file.id, SHAREPOINT_FOLDER_ID, newFileName);
            console.log('Lien downloadUrl de la copie retourné par Graph :', copiedFile['@microsoft.graph.downloadUrl']);
            pdfUrl = copiedFile['@microsoft.graph.downloadUrl'];
          }
        } catch (err) {
          console.error('Erreur lors de la copie du PDF de traçabilité :', err);
        }
        const newRecord: MaintenanceRecord = {
          id: Date.now().toString(),
          vehicleId: selectedVehicle.id,
          systemId: selectedSystem,
          operationId: selectedOperation,
          position: { x: 0, y: 0 },
          timestamp: new Date(),
          comment,
          user: userName,
          status: 'non commencé',
          pdfUrl
        };
        updatedRecords = [...currentRecords, newRecord];
      }
      await updateRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
      resetForm();
      setTab(0);
    }
  };

  // Mise à jour de handleDeleteRecord pour utiliser updateRecords
  const handleDeleteRecord = async (recordId: string) => {
    if (selectedVehicle && selectedConsistency) {
      const updatedRecords = currentRecords.filter(record => record.id !== recordId);
      await updateRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
      setDeleteDialog({open: false, recordId: null});
    }
  };

  // Fonction pour obtenir toutes les fiches en attente
  const getPendingRecords = (): PendingRecord[] => {
    return Object.entries(recordsByConsistency).flatMap(([cons, vehicles]) =>
      Object.entries(vehicles).flatMap(([vehicleId, records]) =>
        records
          .filter(record => record.status === 'en cours' || record.status === 'non commencé')
          .map(record => {
            const currentSystems = cons === 'IS710' ? systems : (localSystems[cons] || []);
            const system = currentSystems.find(s => s.id === record.systemId);
            const operation = system?.operations.find(o => o.id === record.operationId);
            return {
              ...record,
              consistency: cons,
              vehicleId: Number(vehicleId),
              systemName: system?.name || record.systemId,
              operationName: operation?.name || record.operationId
            };
          })
      )
    );
  };

  // Fonction pour obtenir toutes les fiches terminées
  const getDoneRecords = (): PendingRecord[] => {
    return Object.entries(recordsByConsistency).flatMap(([cons, vehicles]) =>
      Object.entries(vehicles).flatMap(([vehicleId, records]) =>
        records
          .filter(record => record.status === 'terminé')
          .map(record => {
            const currentSystems = cons === 'IS710' ? systems : (localSystems[cons] || []);
            const system = currentSystems.find(s => s.id === record.systemId);
            const operation = system?.operations.find(o => o.id === record.operationId);
            return {
              ...record,
              consistency: cons,
              vehicleId: Number(vehicleId),
              systemName: system?.name || record.systemId,
              operationName: operation?.name || record.operationId
            };
          })
      )
    );
  };

  const pendingRecords = getPendingRecords();
  const doneRecords = getDoneRecords();

  // Mise à jour de useEffect pour charger les enregistrements
  useEffect(() => {
    if (selectedVehicle && selectedConsistency) {
      loadRecords(selectedConsistency, selectedVehicle.id);
    }
  }, [selectedVehicle?.id, selectedConsistency]);

  useEffect(() => {
    localStorage.setItem('consistencies', JSON.stringify(consistencies));
  }, [consistencies]);

  useEffect(() => {
    localStorage.setItem('localSystems', JSON.stringify(localSystems));
  }, [localSystems]);

  const currentRecords = recordsByConsistency[selectedConsistency]?.[selectedVehicle?.id || 0] || [];

  // Juste avant le rendu du tableau d'attente
  console.log('pendingRecords', pendingRecords);
  console.log('recordsByConsistency', recordsByConsistency);

  const handleSearchClick = (column: string, event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(prev => ({
      ...prev,
      [column]: event.currentTarget
    }));
  };

  const handleSearchClose = (column: string) => {
    setAnchorEl(prev => ({
      ...prev,
      [column]: null
    }));
  };

  const SearchPopover = ({ column, title }: { column: string, title: string }) => {
    return (
    <Popover
      open={Boolean(anchorEl[column])}
      anchorEl={anchorEl[column]}
      onClose={() => handleSearchClose(column)}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
    >
      <Box sx={{ p: 2 }}>
        {column === 'status' ? (
          <Select
            size="small"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            fullWidth
            displayEmpty
            autoFocus
          >
            <MenuItem value="">Tous les statuts</MenuItem>
            <MenuItem value="non commencé">Non commencé</MenuItem>
            <MenuItem value="en cours">En cours</MenuItem>
            <MenuItem value="terminé">Terminé</MenuItem>
          </Select>
        ) : column === 'date' ? (
          <DatePicker
            value={dateFilter}
            onChange={(newValue: Date | null) => {
              setDateFilter(newValue);
              setFilters({...filters, date: newValue ? newValue.toLocaleDateString() : ''});
            }}
            slotProps={{
              textField: {
                size: "small",
                fullWidth: true,
                autoFocus: true
              }
            }}
          />
        ) : (
          <TextField
            size="small"
            placeholder={`Rechercher dans ${title}...`}
            value={filters[column as keyof typeof filters]}
            onChange={(e) => setFilters({...filters, [column]: e.target.value})}
            fullWidth
            autoFocus
          />
        )}
      </Box>
    </Popover>
  );
  };

  const filteredRecords = currentRecords.filter(record => {
    const system = systems.find(s => s.id === record.systemId);
    const operation = system?.operations.find(o => o.id === record.operationId);
    const recordDate = new Date(record.timestamp);
    const isDateMatch = !dateFilter ||
      (recordDate.getDate() === dateFilter.getDate() &&
        recordDate.getMonth() === dateFilter.getMonth() &&
        recordDate.getFullYear() === dateFilter.getFullYear());
    return (
      (system?.name || '').toLowerCase().includes(filters.system.toLowerCase()) &&
      (operation?.name || '').toLowerCase().includes(filters.operation.toLowerCase()) &&
      isDateMatch &&
      (record.comment || '').toLowerCase().includes(filters.comment.toLowerCase()) &&
      (record.status || 'non commencé').toLowerCase().includes(filters.status.toLowerCase()) &&
      (record.user || 'Inconnu').toLowerCase().includes(filters.user.toLowerCase())
    );
  });

  const handleSelectConsistency = (cons: string) => {
    setSelectedConsistency(cons);
    setSelectedVehicle(null);
    // Nettoyage du localStorage pour éviter la restauration automatique
    localStorage.removeItem('selectedVehicle');
    setRecordsByConsistency(prev => {
      if (prev[cons]) return prev;
      const vehObj: { [vehicleId: number]: MaintenanceRecord[] } = {};
      VEHICLES.forEach(v => { vehObj[v.id] = []; });
      return { ...prev, [cons]: vehObj };
    });
  };

  const currentSystems = selectedConsistency === 'IS710' ? systems : (localSystems[selectedConsistency] || []);

  // Fonctions pour gérer le formulaire dynamique
  const addSystem = () => {
    setNewSystems([
      ...newSystems,
      { id: Date.now().toString(), name: '', operations: [] }
    ]);
  };
  const removeSystem = (sysId: string) => {
    setNewSystems(newSystems.filter(sys => sys.id !== sysId));
  };
  const updateSystemName = (sysId: string, name: string) => {
    setNewSystems(newSystems.map(sys =>
      sys.id === sysId ? { ...sys, name } : sys
    ));
  };
  const addOperation = (sysId: string) => {
    setNewSystems(newSystems.map(sys =>
      sys.id === sysId
        ? { ...sys, operations: [...sys.operations, { id: Date.now().toString(), name: '' }] }
        : sys
    ));
  };
  const updateOperationName = (sysId: string, opId: string, name: string) => {
    setNewSystems(newSystems.map(sys =>
      sys.id === sysId
        ? {
            ...sys,
            operations: sys.operations.map(op =>
              op.id === opId ? { ...op, name } : op
            )
          }
        : sys
    ));
  };
  const removeOperation = (sysId: string, opId: string) => {
    setNewSystems(newSystems.map(sys =>
      sys.id === sysId
        ? { ...sys, operations: sys.operations.filter(op => op.id !== opId) }
        : sys
    ));
  };

  // Chargement des consistances depuis SharePoint au démarrage
  useEffect(() => {
    const fetchConsistencies = async () => {
      if (!accounts || accounts.length === 0) return;
      const response = await instance.acquireTokenSilent({
        scopes: [
          'Files.Read.All',
          'Sites.Read.All',
          'Files.ReadWrite.All',
          'Sites.ReadWrite.All'
        ],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      const sharepointConsistencies = await maintenanceService.getConsistencies();
      setConsistencies(sharepointConsistencies);
    };
    fetchConsistencies();
    // eslint-disable-next-line
  }, []);

  // Ajout d'une consistance : sauvegarde sur SharePoint
  const handleAddConsistency = async (newCons: string) => {
    const newList = [...consistencies, newCons];
    setConsistencies(newList);
    if (!accounts || accounts.length === 0) return;
    const response = await instance.acquireTokenSilent({
      scopes: [
        'Files.Read.All',
        'Sites.Read.All',
        'Files.ReadWrite.All',
        'Sites.ReadWrite.All'
      ],
      account: accounts[0],
    });
    maintenanceService.setAccessToken(response.accessToken);
    await maintenanceService.saveConsistencies(newList);
  };

  // Suppression d'une consistance : sauvegarde sur SharePoint
  const handleDeleteConsistency = async (cons: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer la consistance "${cons}" ?`)) {
      const newList = consistencies.filter(c => c !== cons);
      setConsistencies(newList);
      setLocalSystems(prev => {
        const newObj = { ...prev };
        delete newObj[cons];
        return newObj;
      });
      setRecordsByConsistency(prev => {
        const newObj = { ...prev };
        delete newObj[cons];
        return newObj;
      });
      if (selectedConsistency === cons) {
        setSelectedConsistency('');
        setSelectedVehicle(null);
      }
      if (!accounts || accounts.length === 0) return;
      const response = await instance.acquireTokenSilent({
        scopes: [
          'Files.Read.All',
          'Sites.Read.All',
          'Files.ReadWrite.All',
          'Sites.ReadWrite.All'
        ],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      await maintenanceService.saveConsistencies(newList);
    }
  };

  // Bouton retour global, toujours visible
  const handleBack = () => {
    setSelectedConsistency('');
    setSelectedVehicle(null);
    setShowCustomSysForm(false);
    setShowPdf({operationId: null, type: undefined});
    setShowViewer({url: null});
  };

  const handleAddSysOp = () => {
    if (newOpName.trim()) {
      setNewSysOps([...newSysOps, { id: Date.now().toString(), name: newOpName.trim() }]);
      setNewOpName('');
    }
  };
  const handleSaveNewSystem = () => {
    if (!newSysName.trim() || newSysOps.length === 0) return;
    
    // Action immédiate
    setLocalSystems(prev => ({
      ...prev,
      [selectedConsistency]: [
        ...(prev[selectedConsistency] || []),
        { id: Date.now().toString(), name: newSysName.trim(), operations: newSysOps }
      ]
    }));
    setShowAddSystemForm(false);
    setNewSysName('');
    setNewSysOps([]);
    setNewOpName('');
  };

  // Ajoute une opération vide au formulaire d'ajout de système
  const handleAddOperationField = () => {
    // Action immédiate
    setNewSysOps(prev => [...prev, { id: Date.now().toString(), name: '' }]);
  };

  // Modifie le nom d'une opération dans le formulaire d'ajout de système
  const handleChangeOperation = (idx: number, value: string) => {
    // Action immédiate
    setNewSysOps(ops => ops.map((op, i) => i === idx ? { ...op, name: value } : op));
  };

  // Ajout d'un useEffect pour charger tous les enregistrements au démarrage
  useEffect(() => {
    const loadAllRecords = async () => {
      for (const cons of consistencies) {
        for (const vehicle of VEHICLES) {
          await loadRecords(cons, vehicle.id);
        }
      }
    };
    loadAllRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Se déclenche une seule fois au chargement initial

  // Fonction utilitaire pour comparer deux tableaux d'objets (par JSON.stringify)
  function arraysEqual(a: any[], b: any[]) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Nouvelle version de refreshAllRecords
  const refreshAllRecords = async () => {
    if (!accounts || accounts.length === 0) return;
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Timeout de sécurité : arrête le refresh au bout de 10 secondes quoi qu'il arrive
      timeoutId = setTimeout(() => {}, 10000);
      const response = await instance.acquireTokenSilent({
        scopes: [
          'Files.Read.All',
          'Sites.Read.All',
          'Files.ReadWrite.All',
          'Sites.ReadWrite.All'
        ],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      // 1. Consistances
      const sharepointConsistencies = await maintenanceService.getConsistencies();
      let needUpdate = false;
      if (!arraysEqual(sharepointConsistencies, consistencies)) {
        setConsistencies(sharepointConsistencies);
        needUpdate = true;
      }
      // 2. Enregistrements
      const newRecordsByConsistency: { [cons: string]: { [vehicleId: number]: MaintenanceRecord[] } } = {};
      for (const cons of sharepointConsistencies) {
        newRecordsByConsistency[cons] = {};
        for (const vehicle of VEHICLES) {
          const records = await maintenanceService.getMaintenanceRecords(cons, vehicle.id);
          const localRecords = recordsByConsistency[cons]?.[vehicle.id] || [];
          if (!arraysEqual(records, localRecords)) {
            needUpdate = true;
          }
          newRecordsByConsistency[cons][vehicle.id] = records;
          localStorage.setItem(`records-${cons}-${vehicle.id}`, JSON.stringify(records));
        }
      }
      if (needUpdate) {
        setRecordsByConsistency(newRecordsByConsistency);
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des enregistrements:', err);
      setError('Erreur lors du rafraîchissement des enregistrements');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const formatSystemName = (name: string): string => name.replace(/\./g, '-');

  const handleCreateRecord = async (operationId: string, type: 'tracabilite' | 'protocole') => {
    if (!selectedVehicle || !selectedConsistency) return;

    const operation = systems
      .find(s => s.operations.some(o => o.id === operationId))
      ?.operations.find(o => o.id === operationId);

    if (!operation) {
      throw new Error('Opération non trouvée');
    }

    // Déclare system une seule fois ici
    const system = systems.find(s => s.operations.some(o => o.id === operation.id));

    let pdfUrl: string | undefined = undefined;
    if (type === 'tracabilite') {
      try {
        const token = await instance.acquireTokenSilent({
          scopes: [
            'Files.Read.All',
            'Sites.Read.All',
            'Files.ReadWrite.All',
            'Sites.ReadWrite.All'
          ],
          account: accounts[0],
        });
        maintenanceService.setAccessToken(token.accessToken);
        // Recherche du fichier de traçabilité de base
        const SHAREPOINT_SITE_ID = 'arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d';
        const SHAREPOINT_DRIVE_ID = 'b!b3ZCPc57jkuS4HAnKuK5XvMhps8TUDxDnRQ8UZ8Ru426aMo8mBCBTrOSBU5EbQE4';
        const SHAREPOINT_FOLDER_ID = '01UIJT6YLQOURHAQCBSRB2FWB5PX6OZRJG';
        const formattedSystemName = system ? formatSystemName(system.name) : operation.id;
        const traceabilityFileName = `FT-LGT-${formattedSystemName}.pdf`;
        // Récupérer la liste des fichiers du dossier
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${SHAREPOINT_FOLDER_ID}/children`,
          { headers: { Authorization: `Bearer ${token.accessToken}` } }
        );
        const data = await res.json();
        const file = (data.value as any[]).find((f: any) =>
          f.parentReference && f.parentReference.path && f.parentReference.path.includes('ESSAI OUTILS') &&
          f.name.trim().toLowerCase() === traceabilityFileName.trim().toLowerCase()
        );
        if (file) {
          // Générer le nom de la copie : <NomFichierBase>-YYYYMMDDHHmmss.pdf
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const newFileName = `FT-LGT-${formattedSystemName}-${dateStr}.pdf`;
          // Copier le fichier
          const copiedFile = await maintenanceService.copyFile(file.id, SHAREPOINT_FOLDER_ID, newFileName);
          pdfUrl = copiedFile['@microsoft.graph.downloadUrl'];
        }
      } catch (err) {
        console.error('Erreur lors de la copie du PDF de traçabilité :', err);
      }
    }

    const newRecord: MaintenanceRecord = {
      id: Date.now().toString(),
      vehicleId: selectedVehicle.id,
      systemId: system?.id || '',
      operationId: operation.id,
      position: { x: 0, y: 0 },
      timestamp: new Date(),
      comment: '',
      user: '',
      status: 'non commencé',
      pdfUrl
    };

    const updatedRecords = [...(recordsByConsistency[selectedConsistency]?.[selectedVehicle.id] || []), newRecord];
    await maintenanceService.saveMaintenanceRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
    setRecordsByConsistency(prev => ({
      ...prev,
      [selectedConsistency]: {
        ...prev[selectedConsistency],
        [selectedVehicle.id]: updatedRecords
      }
    }));
    setShowPdf({
      operationId,
      type: 'tracabilite',
      recordId: newRecord.id
    });
  };

  // --- Affichage de la modale PDF (protocole ou traçabilité) si demandée ---
  if (showPdf.operationId && showPdf.type) {
    // Recherche dans tous les enregistrements de toutes les consistances et véhicules
    const allRecords: any[] = Object.entries(recordsByConsistency)
      .flatMap(([cons, vehObj]) =>
        Object.entries(vehObj).flatMap(([vehId, records]) =>
          (records as any[]).map((r: any) => ({ ...r, consistency: cons, vehicleId: Number(vehId) }))
        )
      );
    const record = allRecords.find((r: any) => r.id === showPdf.recordId);

    // --- OUVERTURE FICHE DE TRAÇABILITÉ ---
    if (showPdf.type === 'tracabilite') {
      if (record?.pdfUrl) {
        return (
          <PdfViewerSharepoint
            operationCode={showPdf.operationId}
            type="tracabilite"
            onBack={() => setShowPdf({operationId: null, type: undefined})}
            systems={systems}
            allowStatusChange={true}
            recordId={showPdf.recordId}
            currentStatus={record?.status}
            setStatus={async (newStatus) => {
              if (record) {
                setRecordsByConsistency((prev: Record<string, Record<number, MaintenanceRecord[]>>) => {
                  const prevCons = prev[record.consistency] || {};
                  const prevVeh = prevCons[record.vehicleId] || [];
                  const updated: Record<string, Record<number, MaintenanceRecord[]>> = {
                    ...prev,
                    [record.consistency]: {
                      ...prevCons,
                      [record.vehicleId]: prevVeh.map(r =>
                        r.id === record.id ? { ...r, status: newStatus } : r
                      )
                    }
                  };
                  maintenanceService.saveMaintenanceRecords(
                    record.consistency,
                    record.vehicleId,
                    (updated as Record<string, Record<number, MaintenanceRecord[]>>)[record.consistency][record.vehicleId]
                  );
                  return updated;
                });
              }
            }}
          />
        );
      }
      return (
        <Dialog open onClose={() => setShowPdf({operationId: null, type: undefined})}>
          <DialogTitle>Fiche de traçabilité non disponible</DialogTitle>
          <DialogContent>
            <Typography color="error">Impossible de trouver la fiche de traçabilité pour cet enregistrement.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPdf({operationId: null, type: undefined})}>Fermer</Button>
          </DialogActions>
        </Dialog>
      );
    }

    // --- OUVERTURE PROTOCOLE ---
    if (showPdf.type === 'protocole') {
      const system = systems.find((s: System) => s.operations.some((o: { id: string }) => o.id === showPdf.operationId));
      const operation = system?.operations.find((o: { id: string }) => o.id === showPdf.operationId);
      if (operation) {
        return (
          <PdfViewerSharepoint
            operationCode={showPdf.operationId}
            type="protocole"
            onBack={() => setShowPdf({operationId: null, type: undefined})}
            systems={systems}
            allowStatusChange={false}
            recordId={showPdf.recordId}
          />
        );
      }
      return (
        <Dialog open onClose={() => setShowPdf({operationId: null, type: undefined})}>
          <DialogTitle>Protocole non disponible</DialogTitle>
          <DialogContent>
            <Typography color="error">Impossible de trouver le protocole pour cette opération.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPdf({operationId: null, type: undefined})}>Fermer</Button>
          </DialogActions>
        </Dialog>
      );
    }
  }
  // ... existing code ...

  // Affichage principal détaillé : uniquement si consistance ET véhicule sélectionnés
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{ 
          height: '100vh',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          position: 'relative',
          marginTop: isMobile ? '56px' : '100px',
          background: '#f7f7f7'
        }}
      >
        <Divider sx={{ mb: 2, borderBottomWidth: 2 }} />
        <Box sx={{ 
          minHeight: '100vh',
          overflowX: 'hidden'
        }}>
          <Box>
            {/* SUPPRESSION DU BOUTON RETOUR ICI */}
            {/* PAGE D'ACCUEIL : choix consistance + tableau opérations en attente */}
            { !selectedConsistency && (
      <>
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>Choisissez une consistance</Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 2,
                      mt: 4,
                      alignItems: 'center',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      px: 1,
                      scrollbarWidth: 'thin',
                      '&::-webkit-scrollbar': { height: 6 },
                      '&::-webkit-scrollbar-thumb': { background: '#bbb', borderRadius: 3 }
                    }}
                  >
            {consistencies.map((cons) => (
              <Button
                key={cons}
                variant="contained"
                color="primary"
                size="large"
                        sx={{ py: 2, px: 6, fontSize: 22, minWidth: 120, flex: '0 0 auto' }}
                onClick={() => handleSelectConsistency(cons)}
              >
                {cons}
              </Button>
            ))}
                    <IconButton color="primary" sx={{ ml: 1, flex: '0 0 auto' }} onClick={() => setAddConsDialogOpen(true)}>
              <AddIcon />
            </IconButton>
          </Box>
        </Box>
                {/* Tableau des opérations en attente */}
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 8, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <Typography variant="h5" sx={{ mb: 0, textAlign: 'center' }}>Opérations en attente</Typography>
            <IconButton size="small" sx={{ ml: 1, color: '#888', p: 0.5 }} onClick={refreshAllRecords} title="Rafraîchir">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableBody>
                {pendingRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" style={{ color: '#888' }}>
                      Aucune opération en attente
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRecords.map((record: PendingRecord) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.consistency}</TableCell>
                      <TableCell>Véhicule {record.vehicleId}</TableCell>
                      <TableCell>{record.systemName}</TableCell>
                      <TableCell>{record.operationName}</TableCell>
                      <TableCell>
                        <span style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: record.status === 'en cours' ? '#ff9800' : '#f44336',
                          border: '1px solid #bbb',
                          verticalAlign: 'middle',
                          marginRight: 4
                        }} />
                                {(() => { console.log('Affichage statut', record.status, 'pour', record); return record.status || 'non commencé'; })()}
                      </TableCell>
                      <TableCell>{new Date(record.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{record.user || 'Inconnu'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
                {/* Tableau des opérations terminées */}
                <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <Typography variant="h5" sx={{ mb: 0, textAlign: 'center' }}>Opérations terminées</Typography>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableBody>
                        {doneRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" style={{ color: '#888' }}>
                              Aucune opération terminée
                            </TableCell>
                          </TableRow>
                        ) : (
                          doneRecords.map((record: PendingRecord) => (
                            <TableRow key={record.id}>
                              <TableCell>{record.consistency}</TableCell>
                              <TableCell>Véhicule {record.vehicleId}</TableCell>
                              <TableCell>{record.systemName}</TableCell>
                              <TableCell>{record.operationName}</TableCell>
                              <TableCell>
                                <span style={{
                                  display: 'inline-block',
                                  width: 14,
                                  height: 14,
                                  borderRadius: '50%',
                                  background: '#4caf50',
                                  border: '1px solid #bbb',
                                  verticalAlign: 'middle',
                                  marginRight: 4
                                }} />
                                terminé
                              </TableCell>
                              <TableCell>{new Date(record.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{record.user || 'Inconnu'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
        <Dialog open={addConsDialogOpen} onClose={() => setAddConsDialogOpen(false)}>
          <DialogTitle>Ajouter une consistance</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Nom de la consistance"
              fullWidth
              value={newConsName}
              onChange={e => setNewConsName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddConsDialogOpen(false)}>Annuler</Button>
            <Button
                      onClick={async () => {
                        await handleAddConsistency(newConsName.trim());
                setAddConsDialogOpen(false);
                setShowCustomSysForm(true);
              }}
              disabled={!newConsName.trim() || consistencies.includes(newConsName.trim())}
              variant="contained"
            >
              Ajouter
            </Button>
          </DialogActions>
        </Dialog>
      </>
            )}
            {/* Ensuite, si consistance sélectionnée mais pas de véhicule, choix du véhicule */}
            { selectedConsistency && !selectedVehicle && (
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>Consistance : {selectedConsistency}</Typography>
        <Typography variant="h6" sx={{ mb: 3, textAlign: 'center' }}>Choisissez un véhicule</Typography>
        <FormControl fullWidth variant="outlined">
          <InputLabel id="vehicle-select-label" shrink variant="outlined">Véhicule</InputLabel>
          <Select
            labelId="vehicle-select-label"
            value={selectedVehicle ? String((selectedVehicle as Vehicle).id) : ''}
            label="Véhicule"
            onChange={(e: SelectChangeEvent<string>) => {
              const veh = VEHICLES.find((v) => v.id === Number(e.target.value));
              if (veh) setSelectedVehicle(veh);
            }}
            variant="outlined"
          >
            {VEHICLES.map((veh) => (
              <MenuItem key={veh.id} value={String(veh.id)}>{veh.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
            )}
            {/* Sinon, vue détaillée véhicule/consistance comme actuellement */}
            { selectedConsistency && selectedVehicle && (
              <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, ml: isMobile ? 0 : 8 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setSelectedConsistency('')}
            sx={{ minWidth: 90 }}
            size="small"
          >
            Retour
          </Button>
          <Typography
            variant="h6"
            sx={{ fontSize: isMobile ? '1rem' : '1.15rem', ml: 2, minWidth: 180 }}
          >
            Consistance : {selectedConsistency}
          </Typography>
          <FormControl sx={{ minWidth: 180, ml: 2 }} size="small" fullWidth={isMobile}>
            <InputLabel id="vehicle-select-label-main" shrink>Véhicule</InputLabel>
            <Select
              labelId="vehicle-select-label-main"
              value={selectedVehicle ? String((selectedVehicle as Vehicle).id) : ''}
              label="Véhicule"
              onChange={(e: SelectChangeEvent<string>) => {
                const veh = VEHICLES.find((v) => v.id === Number(e.target.value));
                if (veh) setSelectedVehicle(veh);
              }}
              size="small"
            >
              {VEHICLES.map((veh) => (
                <MenuItem key={veh.id} value={String(veh.id)}>{veh.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedConsistency !== 'IS710' && (
            <IconButton color="error" onClick={() => handleDeleteConsistency(selectedConsistency)} sx={{ ml: 1 }} size="small">
              <DeleteIcon />
            </IconButton>
          )}
          <Button variant="outlined" sx={{ ml: 2 }} onClick={() => setShowAddSystemForm(v => !v)} size="small">
            Ajouter un système
          </Button>
          {showAddSystemForm && (
            <Paper sx={{ p: 2, mt: 2, mb: 2, maxWidth: 400 }} elevation={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>Nouveau système</Typography>
              <TextField
                label="Nom du système"
                value={newSysName || ''}
                onChange={e => setNewSysName(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Opérations</Typography>
              {(newSysOps || []).map((op, idx) => (
                <TextField
                  key={op.id}
                  label={`Opération ${idx + 1}`}
                  value={op.name}
                  onChange={e => handleChangeOperation(idx, e.target.value)}
                  fullWidth
                  sx={{ mb: 1 }}
                />
              ))}
              <Button onClick={handleAddOperationField} size="small" sx={{ mb: 2 }}>Ajouter une opération</Button>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button variant="contained" color="primary" onClick={handleSaveNewSystem}>Valider</Button>
                <Button variant="outlined" color="secondary" onClick={() => setShowAddSystemForm(false)}>Annuler</Button>
              </Box>
            </Paper>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            sx={{
              fontWeight: 700,
              fontFamily: `'Montserrat', 'Roboto', 'Arial', sans-serif`,
              fontSize: isMobile ? '1.3rem' : '2rem',
              textAlign: 'center',
              letterSpacing: 1,
              color: '#222',
              mb: isMobile ? 1 : 2,
              width: '100%'
            }}
          >
            Plan du véhicule {selectedVehicle?.name || 'Non sélectionné'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            fullWidth={isMobile}
            sx={{ my: isMobile ? 1 : 2, py: isMobile ? 1.2 : 1.5, fontSize: isMobile ? '1rem' : '1.1rem' }}
            onClick={() => setSelectedConsistency('')}
          >
            {selectedConsistency || 'Choisir la consistance'}
          </Button>
        </Box>
        {/* Onglets HISTORIQUE et AJOUTER UN ENREGISTREMENT placés ici */}
        <Paper elevation={2} sx={{ mb: 2, maxWidth: 900, mx: 'auto' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            sx={{ minHeight: isMobile ? 36 : 48 }}
          >
            <Tab label={t.history} />
            <Tab label={editingRecord ? t.edit : t.addRecord} />
          </Tabs>
        </Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ mt: 4 }}>{error}</Typography>
        ) : (
          <Box sx={{ p: 3 }}>
            {selectedConsistency ? (
              <Typography variant="h6" sx={{ mb: 2 }}>Consistance actuelle : {selectedConsistency}</Typography>
                    ) : null}
            {tab === 0 && (
              isMobile ? (
                <Box sx={{ width: '100%', mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filteredRecords.length === 0 ? (
                    <Typography align="center" sx={{ color: '#888', fontSize: '1rem', mt: 2 }}>{t.noRecord}</Typography>
                  ) : filteredRecords.map((record) => {
                    const system = currentSystems.find(s => s.id === record.systemId);
                    const operation = system?.operations.find(o => o.id === record.operationId);
                    let color = '#f44336';
                    if (record.status === 'en cours') color = '#ff9800';
                    if (record.status === 'terminé') color = '#4caf50';
                    return (
                      <Paper key={record.id} sx={{ p: 2, borderRadius: 2, boxShadow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{system?.name || record.systemId}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={t.edit}><IconButton size="small" onClick={() => handleEditRecord(record)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title={t.delete}><IconButton size="small" color="error" onClick={() => setDeleteDialog({open: true, recordId: record.id})}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}><b>{t.operation} :</b> {operation?.name || record.operationId}</Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}><b>{t.date} :</b> {new Date(record.timestamp).toLocaleString()}</Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}><b>{t.comment} :</b> {record.comment}</Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}><b>Statut :</b> <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: color, border: '1px solid #bbb', verticalAlign: 'middle', marginRight: 4 }} />{record.status || 'non commencé'}</Typography>
                        <Typography variant="body2"><b>{t.user} :</b> {record.user || 'Inconnu'}</Typography>
                      </Paper>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ width: '100%', overflowX: 'visible', mb: 2 }}>
                  <TableContainer component={Paper} sx={{ minWidth: 650 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{t.system}</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('system', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="system" title="Système" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{t.operation}</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('operation', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="operation" title="Opération" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{t.date}</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('date', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="date" title="Date" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{t.comment}</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('comment', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="comment" title="Commentaire" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>Statut de la fiche de traçabilité</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('status', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="status" title="Statut" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>Utilisateur</span>
                              <IconButton size="small" onClick={(e) => handleSearchClick('user', e)}>
                                <SearchIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <SearchPopover column="user" title="Utilisateur" />
                          </TableCell>
                          <TableCell align="right">{t.actions}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center">{t.noRecord}</TableCell>
                          </TableRow>
                        ) : filteredRecords.map((record) => {
                          const system = currentSystems.find(s => s.id === record.systemId);
                          const operation = system?.operations.find(o => o.id === record.operationId);
                          // Couleur du statut
                          let color = '#f44336'; // rouge par défaut
                          if (record.status === 'en cours') color = '#ff9800'; // orange
                          if (record.status === 'terminé') color = '#4caf50'; // vert
                          return (
                            <TableRow key={record.id}>
                              <TableCell>{system?.name || record.systemId}</TableCell>
                              <TableCell>{operation?.name || record.operationId}</TableCell>
                              <TableCell>{new Date(record.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{record.comment}</TableCell>
                              <TableCell>
                                <span style={{
                                  display: 'inline-block',
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: color,
                                  border: '1px solid #bbb',
                                  verticalAlign: 'middle',
                                  marginRight: 6
                                }} />
                                <span style={{ fontSize: 13, color: '#444' }}>{record.status || 'non commencé'}</span>
                              </TableCell>
                              <TableCell>{record.user || 'Inconnu'}</TableCell>
                              <TableCell align="right">
                                <Tooltip title={t.edit}>
                                  <IconButton onClick={() => handleEditRecord(record)}><EditIcon /></IconButton>
                                </Tooltip>
                                <Tooltip title={t.delete}>
                                  <IconButton color="error" onClick={() => setDeleteDialog({open: true, recordId: record.id})}><DeleteIcon /></IconButton>
                                </Tooltip>
                                {/* Bouton pour ouvrir la fiche de traçabilité de cet enregistrement */}
                                <Tooltip title="Ouvrir la fiche de traçabilité">
                                  <IconButton color="secondary" onClick={() => setShowPdf({operationId: record.operationId, type: 'tracabilite', allowStatusChange: true, recordId: record.id})}>
                                    <span style={{fontWeight: 'bold', color: '#9c27b0'}}>FT</span>
                                  </IconButton>
                                </Tooltip>
                                {/* Bouton pour ouvrir le protocole de cet enregistrement (optionnel) */}
                                <Tooltip title="Ouvrir le protocole SharePoint">
                                  <IconButton color="primary" onClick={() => setShowPdf({operationId: record.operationId, type: 'protocole', allowStatusChange: false, recordId: record.id})}>
                                    <span style={{fontWeight: 'bold', color: '#1976d2'}}>P</span>
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )
            )}
            {tab === 1 && (
              <Box sx={{ maxWidth: 400, mx: 'auto', mt: 2 }}>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel id="system-select-label">{t.system}</InputLabel>
                  <Select
                    labelId="system-select-label"
                    value={selectedSystem}
                    onChange={(e) => { setSelectedSystem(e.target.value); setSelectedOperation(''); }}
                    label={t.system}
                  >
                    {currentSystems.map((system) => (
                      <MenuItem key={system.id} value={system.id}>{system.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel id="operation-select-label">{t.operation}</InputLabel>
                  <Select
                    labelId="operation-select-label"
                    value={selectedOperation}
                    onChange={(e) => setSelectedOperation(e.target.value)}
                    label={t.operation}
                    disabled={!selectedSystem}
                  >
                    {selectedSystem && currentSystems.find(s => s.id === selectedSystem)?.operations.map((operation) => (
                      <MenuItem key={operation.id} value={operation.id}>{operation.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label={t.comment}
                  multiline
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  sx={{ mt: 2 }}
                />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {selectedOperation && (() => {
                    const selectedSys = currentSystems.find(s => s.id === selectedSystem);
                    const selectedOp = selectedSys?.operations.find(o => o.id === selectedOperation);
                    return selectedOp ? <>
                      <Button
                        variant="outlined"
                                onClick={() => setShowPdf({operationId: selectedOperation, type: 'protocole', allowStatusChange: false})}
                        disabled={
                          selectedConsistency === 'IS710'
                            ? (!("protocolUrl" in selectedOp) || !selectedOp.protocolUrl) && !selectedOp.id
                            : !selectedOp.id
                        }
                      >
                        Ouvrir le protocole SharePoint
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                                onClick={() => editingRecord && setShowPdf({operationId: editingRecord.operationId, type: 'tracabilite', allowStatusChange: true, recordId: editingRecord.id})}
                                disabled={!editingRecord}
                      >
                        Ouvrir la fiche de traçabilité
                      </Button>
                    </> : null;
                  })()}
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={() => { resetForm(); setTab(0); }}>{t.cancel}</Button>
                  <Button variant="contained" onClick={handleAddOrEdit} disabled={!selectedSystem || !selectedOperation}>
                    {editingRecord ? t.update : t.save}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({open: false, recordId: null})}>
          <DialogTitle>{t.confirmDeleteTitle}</DialogTitle>
          <DialogContent>
            <Typography>{t.confirmDeleteText}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({open: false, recordId: null})}>{t.cancel}</Button>
            <Button color="error" onClick={() => deleteDialog.recordId && handleDeleteRecord(deleteDialog.recordId)}>{t.delete}</Button>
          </DialogActions>
        </Dialog>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

interface EditablePDFViewerProps {
  url: string;
  fileId?: string; // Ajout de l'ID du fichier pour l'upload
  onSave: (modifiedPdf: Uint8Array | null, newStatus: 'en cours' | 'terminé') => Promise<void>;
  status: 'en cours' | 'terminé';
  onStatusChange: (status: 'en cours' | 'terminé') => void;
  saving: boolean;
  onBack: () => void;
}
const EditablePDFViewer: React.FC<EditablePDFViewerProps> = ({ url, fileId, onSave, status, onStatusChange, saving, onBack }) => {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [annotation, setAnnotation] = React.useState('');
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [savingPdf, setSavingPdf] = React.useState(false);

  React.useEffect(() => {
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buf => setPdfData(new Uint8Array(buf)));
  }, [url]);

  const handleAddAnnotation = async () => {
    if (!pdfData || !annotation) return;
    setLoading(true);
    const pdfDoc = await PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    firstPage.drawText(annotation, {
      x: 50,
      y: firstPage.getHeight() - 50,
      size: 18,
      color: rgb(1, 0, 0),
    });
    const modifiedPdf = await pdfDoc.save();
    setPdfData(modifiedPdf);
    setAnnotation('');
    setLoading(false);
  };

  const handleSave = async (newStatus: 'en cours' | 'terminé') => {
    setSavingPdf(true);
    try {
      if (pdfData && fileId) {
        // Upload du PDF modifié sur SharePoint
        const maintenanceService = MaintenanceService.getInstance();
        await maintenanceService.updatePdfFile(fileId, pdfData);
      }
      await onStatusChange(newStatus);
      if (onSave) await onSave(pdfData, newStatus);
      onBack();
    } catch (err) {
      alert('Erreur lors de la sauvegarde du PDF : ' + err);
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '80vh', overflow: 'auto', background: '#222' }}>
      <div style={{ margin: 8, display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={annotation}
          onChange={e => setAnnotation(e.target.value)}
          placeholder="Ajouter une annotation (texte)"
          disabled={loading}
        />
        <button onClick={handleAddAnnotation} disabled={loading || !annotation}>Annoter</button>
      </div>
      {pdfData && (
        <iframe
          src={URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }))}
          title="PDF modifiable"
          width="100%"
          height="700px"
          style={{ border: 'none', background: '#fff' }}
        />
      )}
      {!pdfData && <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Chargement du PDF…</div>}
      <div style={{ margin: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => handleSave('en cours')} disabled={savingPdf || loading}>Sauvegarder</button>
        <button onClick={() => handleSave('terminé')} disabled={savingPdf || loading}>Terminer</button>
      </div>
    </div>
  );
};

export default VehiclePlan; 