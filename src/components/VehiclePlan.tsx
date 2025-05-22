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
  Popover
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
}
function PdfViewerSharepoint({ operationCode, type, onBack, setStatus, currentStatus, setTab, systems }: PdfViewerSharepointProps) {
  const { instance, accounts } = useMsal();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [excelUrl, setExcelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        'Sites.ReadWrite.All',
        'Sites.ReadWrite.All'
      ],
      account: accounts[0],
    });
    return response.accessToken;
  };

  const handleStatusChange = async (newStatus: 'en cours' | 'terminé') => {
    if (type !== 'tracabilite') return;
    
    setSaving(true);
    try {
      const token = await getAccessToken();
      const SHAREPOINT_SITE_ID = 'arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d';
      const SHAREPOINT_DRIVE_ID = 'b!b3ZCPc57jkuS4HAnKuK5XvMhps8TUDxDnRQ8UZ8Ru426aMo8mBCBTrOSBU5EbQE4';
      const SHAREPOINT_FOLDER_ID = '01UIJT6YJKMFDSJS4PPJDKVHBTW3MXZ5DO';

      // 1. Récupérer le fichier Excel
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${SHAREPOINT_FOLDER_ID}/children`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      
      // Trouver le fichier Excel correspondant
      const system = systems.find((s: System) => s.operations.some((o: { id: string }) => o.id === operationCode));
      if (!system) {
        throw new Error('Système non trouvé');
      }
      const formattedSystemName = formatSystemName(system.name);
      const traceabilityFileName = `FT-LGT-${formattedSystemName}.xlsx`;
      
      const file = (data.value as any[]).find((f: any) =>
        f.name.trim().toLowerCase() === traceabilityFileName.trim().toLowerCase()
      );

      if (!file) {
        throw new Error('Fichier de traçabilité non trouvé');
      }

      // 2. Créer un lien de partage avec les permissions d'édition
      const shareResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${file.id}/createLink`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'edit',
            scope: 'anonymous'
          })
        }
      );
      const shareData = await shareResponse.json();

      // 3. Mettre à jour l'URL de l'iframe avec le mode édition
      const officeUrl = `https://arlingtonfleetfrance.sharepoint.com/_layouts/15/WopiFrame.aspx?sourcedoc=${file.id}&action=edit&wdInitialSession=${encodeURIComponent(JSON.stringify({
        access_token: token,
        share_url: shareData.link.webUrl
      }))}`;

      setObjectUrl(officeUrl);

      // 4. Mettre à jour le statut dans l'application
      if (setStatus) {
        await setStatus(newStatus);
      }

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
      const SHAREPOINT_FOLDER_ID = '01UIJT6YJKMFDSJS4PPJDKVHBTW3MXZ5DO';
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${SHAREPOINT_FOLDER_ID}/children`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      let file;
      if (type === 'protocole') {
        file = (data.value as any[]).find((f: any) =>
          f.name.startsWith(operationCode + '-') && f.name.endsWith('.pdf') && f.name.toLowerCase().includes('protocole')
        );
        if (!file) {
          file = (data.value as any[]).find((f: any) =>
            f.name.startsWith(operationCode + '-') && f.name.endsWith('.pdf')
          );
        }
        if (file && file['@microsoft.graph.downloadUrl']) {
          setPdfUrl(file['@microsoft.graph.downloadUrl']);
          const pdfBlob = await fetch(file['@microsoft.graph.downloadUrl']);
          const blob = await pdfBlob.blob();
          const url = URL.createObjectURL(blob);
          setObjectUrl(url);
        } else {
          setError('protocole non disponible');
        }
      } else {
        // Recherche fiche de traçabilité par nom du système
        const system = systems.find((s: System) => s.operations.some((o: { id: string }) => o.id === operationCode));
        if (!system) {
          setError('Système non trouvé');
          return;
        }
        const formattedSystemName = formatSystemName(system.name);
        const traceabilityFileName = `FT-LGT-${formattedSystemName}.xlsx`;
        
        file = (data.value as any[]).find((f: any) =>
          f.name.trim().toLowerCase() === traceabilityFileName.trim().toLowerCase()
        );

        if (!file) {
          setError('fiche de traçabilité non disponible');
          return;
        }

        // Créer un lien de partage avec les permissions d'édition
        const shareResponse = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/items/${file.id}/createLink`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'edit',
              scope: 'anonymous'
            })
          }
        );
        const shareData = await shareResponse.json();

        // Construire l'URL Office Online en mode édition avec les paramètres nécessaires
        const officeUrl = `https://arlingtonfleetfrance.sharepoint.com/_layouts/15/WopiFrame.aspx?sourcedoc=${file.id}&action=edit&wdInitialSession=${encodeURIComponent(JSON.stringify({
          access_token: token,
          share_url: shareData.link.webUrl,
          wdInitialSession: {
            access_token: token,
            share_url: shareData.link.webUrl
          }
        }))}`;

        setObjectUrl(officeUrl);
      }
    } catch (e) {
      console.error('Erreur lors de la récupération du document:', e);
      setError('Erreur lors de la récupération du document.');
    }
    setLoading(false);
  };

  useEffect(() => {
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
            {type === 'tracabilite' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
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
              </Box>
            )}
          </Box>
        </DialogTitle>
      )}
      <DialogContent sx={{ p: 0, ...(isMobile && { px: 0, py: 0, m: 0 }) }}>
        {loading && (
          <Box sx={{ color: 'text.primary', fontSize: 24, textAlign: 'center', mt: 10 }}>Chargement…</Box>
        )}
        {!loading && type === 'tracabilite' && (
          objectUrl ? (
            <iframe
              ref={iframeRef}
              src={objectUrl}
              title={operationCode + '-' + type}
              width={isMobile ? '100vw' : '100%'}
              height={isMobile ? '100vh' : '800px'}
              style={{ border: 'none', maxWidth: isMobile ? '100vw' : undefined, display: 'block', minHeight: isMobile ? '100vh' : undefined }}
              allowFullScreen
            />
          ) : (
            <Box sx={{ color: 'red', fontWeight: 'bold', fontSize: '1.1rem', mt: 10, textAlign: 'center' }}>
              fiche de traçabilité non disponible
            </Box>
          )
        )}
        {!loading && type === 'protocole' && (
          objectUrl ? (
            <iframe
              src={objectUrl}
              title={operationCode + '-' + type}
              width={isMobile ? '100vw' : '100%'}
              height={isMobile ? '100vh' : '800px'}
              style={{ border: 'none', maxWidth: isMobile ? '100vw' : undefined, display: 'block', minHeight: isMobile ? '100vh' : undefined }}
              allowFullScreen
            />
          ) : (
            <Box sx={{ color: 'red', fontWeight: 'bold', fontSize: '1.1rem', mt: 10, textAlign: 'center' }}>
              protocole non disponible
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
        <iframe src={url} title={url} width="100%" height="800px" style={{ border: 'none' }} />
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
  const [showPdf, setShowPdf] = useState<{operationId: string|null, type?: 'protocole'|'tracabilite'}>({operationId: null, type: undefined});
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
        scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
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
        scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
        account: accounts[0],
      });
      maintenanceService.setAccessToken(response.accessToken);
      let records = await maintenanceService.getMaintenanceRecords(consistency, vehicleId);

      // Synchronisation du statut avec la colonne Excel
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const opCode = record.operationId;
        const folderPath = '/AFF-Projets/Le Grand Tour/Etude Maintenance/40.DOCUMENTATION/44-Signature';
        const filesRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d/drive/root:${folderPath}:/children`,
          { headers: { Authorization: `Bearer ${response.accessToken}` } }
        );
        const filesData = await filesRes.json();
        let file = (filesData.value as any[]).find((f: any) => f.name === `FT-LGT-${opCode}.xlsx`);
        if (!file) {
          file = (filesData.value as any[]).find((f: any) => f.name.includes(opCode) && f.name.endsWith('.xlsx'));
        }
        if (file && file['@microsoft.graph.downloadUrl']) {
          try {
            const excelBlob = await fetch(file['@microsoft.graph.downloadUrl']);
            const arrayBuffer = await excelBlob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | undefined)[][];
            const headerRow = excelData[0] as string[];
            const statusColIndex = headerRow.findIndex((col) => col && col.toLowerCase().includes('statut'));
            let statusValue: 'non commencé' | 'en cours' | 'terminé' = 'non commencé';
            if (statusColIndex !== -1 && excelData[1] && typeof excelData[1][statusColIndex] === 'string') {
              const cellValue = (excelData[1][statusColIndex] as string).toLowerCase();
              if (cellValue.includes('en cours')) statusValue = 'en cours';
              else if (cellValue.includes('terminé')) statusValue = 'terminé';
            }
            records[i].status = statusValue;
          } catch (e) {
            // Si erreur de lecture Excel, on laisse le statut existant
          }
        }
      }
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

  // Mise à jour de handleAddOrEdit pour utiliser updateRecords
  const handleAddOrEdit = async () => {
    if (selectedSystem && selectedOperation && selectedVehicle && selectedConsistency) {
      let updatedRecords: MaintenanceRecord[];
      if (editingRecord) {
        updatedRecords = currentRecords.map(record =>
          record.id === editingRecord.id 
            ? { ...record, systemId: selectedSystem, operationId: selectedOperation, comment, user: userName }
            : record
        );
      } else {
        const newRecord: MaintenanceRecord = {
          id: Date.now().toString(),
          vehicleId: selectedVehicle.id,
          systemId: selectedSystem,
          operationId: selectedOperation,
          position: { x: 0, y: 0 },
          timestamp: new Date(),
          comment,
          user: userName,
          status: 'non commencé'
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
  const pendingRecords = getPendingRecords();

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

  const SearchPopover = ({ column, title }: { column: string, title: string }) => (
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

  // Fonction pour supprimer une consistance
  const handleDeleteConsistency = (cons: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer la consistance "${cons}" ?`)) {
      setConsistencies(prev => prev.filter(c => c !== cons));
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
      // Si la consistance supprimée était sélectionnée, on la désélectionne
      if (selectedConsistency === cons) {
        setSelectedConsistency('');
        setSelectedVehicle(null);
      }
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

  // Modification de la fonction refreshAllRecords pour qu'elle soit plus robuste
  const refreshAllRecords = async () => {
    setLoading(true);
    try {
      for (const cons of consistencies) {
        for (const vehicle of VEHICLES) {
          await loadRecords(cons, vehicle.id);
        }
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des enregistrements:', err);
      setError('Erreur lors du rafraîchissement des enregistrements');
    } finally {
      setLoading(false);
    }
  };

  // 1. Choix de la consistance
  if (!selectedConsistency) {
    return (
      <>
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>Choisissez une consistance</Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4, alignItems: 'center' }}>
            {consistencies.map((cons) => (
              <Button
                key={cons}
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 2, px: 6, fontSize: 22 }}
                onClick={() => handleSelectConsistency(cons)}
              >
                {cons}
              </Button>
            ))}
            <IconButton color="primary" sx={{ ml: 1 }} onClick={() => setAddConsDialogOpen(true)}>
              <AddIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Historique des fiches de traçabilité en cours ou non commencées */}
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
                        {record.status}
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
              onClick={() => {
                setConsistencies([...consistencies, newConsName.trim()]);
                setSelectedConsistency(newConsName.trim());
                setSelectedVehicle(null);
                setRecordsByConsistency(prev => {
                  const newObj = { ...prev };
                  const vehObj: { [vehicleId: number]: MaintenanceRecord[] } = {};
                  VEHICLES.forEach(v => { vehObj[v.id] = []; });
                  newObj[newConsName.trim()] = vehObj;
                  return newObj;
                });
                setLocalSystems((prev) => ({ ...prev, [newConsName.trim()]: [] }));
                setAddConsDialogOpen(false);
                setNewConsName('');
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
    );
  }

  // 2. Choix du véhicule (affiché en haut de l'interface principale aussi)
  if (!selectedVehicle) {
    return (
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>Consistance : {selectedConsistency}</Typography>
        <Typography variant="h6" sx={{ mb: 3, textAlign: 'center' }}>Choisissez un véhicule</Typography>
        <FormControl fullWidth>
          <InputLabel id="vehicle-select-label">Véhicule</InputLabel>
          <Select
            labelId="vehicle-select-label"
            value={selectedVehicle ? String((selectedVehicle as Vehicle).id) : ''}
            label="Véhicule"
            onChange={(e: SelectChangeEvent<string>) => {
              const veh = VEHICLES.find((v) => v.id === Number(e.target.value));
              if (veh) setSelectedVehicle(veh);
            }}
          >
            {VEHICLES.map((veh) => (
              <MenuItem key={veh.id} value={String(veh.id)}>{veh.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  if (selectedConsistency !== 'IS710' && showCustomSysForm && (!localSystems[selectedConsistency] || localSystems[selectedConsistency].length === 0)) {
    // Nouveau formulaire dynamique pour ajouter des systèmes et opérations
    return (
      <>
        <Box sx={{ mt: 4, mb: 2 }}>
          <Button variant="outlined" onClick={handleBack}>
            ← Retour
          </Button>
        </Box>
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8 }}>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>Définir les systèmes et opérations pour {selectedConsistency}</Typography>
          <Box>
            {newSystems.map((sys, sysIdx) => (
              <Box key={sys.id} sx={{ mb: 3, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TextField
                    label={`Nom du système #${sysIdx + 1}`}
                    value={sys.name}
                    onChange={e => updateSystemName(sys.id, e.target.value)}
                    sx={{ flex: 1, mr: 2 }}
                  />
                  <Button color="error" onClick={() => removeSystem(sys.id)}>Supprimer système</Button>
                </Box>
                <Box sx={{ ml: 2 }}>
                  {sys.operations.map((op, opIdx) => (
                    <Box key={op.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TextField
                        label={`Opération #${opIdx + 1}`}
                        value={op.name}
                        onChange={e => updateOperationName(sys.id, op.id, e.target.value)}
                        sx={{ flex: 1, mr: 2 }}
                      />
                      <Button color="error" onClick={() => removeOperation(sys.id, op.id)}>Supprimer</Button>
                    </Box>
                  ))}
                  <Button onClick={() => addOperation(sys.id)}>Ajouter une opération</Button>
                </Box>
              </Box>
            ))}
            <Button variant="outlined" onClick={addSystem} sx={{ mb: 2 }}>Ajouter un système</Button>
          </Box>
          <Button
            sx={{ mt: 3 }}
            variant="contained"
            color="success"
            disabled={newSystems.length === 0 || newSystems.some(sys => !sys.name || sys.operations.length === 0 || sys.operations.some(op => !op.name))}
            onClick={() => {
              setLocalSystems(prev => ({
                ...prev,
                [selectedConsistency]: newSystems
              }));
              setShowCustomSysForm(false);
            }}
          >
            Commencer la maintenance
          </Button>
        </Box>
      </>
    );
  }

  if (showPdf.operationId && showPdf.type) {
    const record = recordsByConsistency[selectedConsistency][selectedVehicle!.id].find(r => r.operationId === showPdf.operationId);
    return (
      <PdfViewerSharepoint
        operationCode={showPdf.operationId}
        type={showPdf.type}
        onBack={() => setShowPdf({operationId: null, type: undefined})}
        setStatus={record ? async (status) => {
          if (selectedVehicle && selectedConsistency) {
            const updatedRecords = recordsByConsistency[selectedConsistency][selectedVehicle.id].map(r =>
              r.id === record.id ? { ...r, status } : r
            );
            await updateRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
          }
        } : undefined}
        currentStatus={record?.status || 'non commencé'}
        setTab={setTab}
        systems={systems}
      />
    );
  }
  if (showViewer.url) {
    const record = recordsByConsistency[selectedConsistency][selectedVehicle!.id].find(r => r.operationId === selectedOperation);
    return (
      <ViewerModal
        url={showViewer.url}
        onBack={() => setShowViewer({url: null})}
        recordId={record?.id}
        setStatus={record ? async (status) => {
          if (selectedVehicle && selectedConsistency) {
            const updatedRecords = recordsByConsistency[selectedConsistency][selectedVehicle.id].map(r =>
              r.id === record.id ? { ...r, status } : r
            );
            await updateRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
          }
        } : undefined}
        currentStatus={record?.status || 'non commencé'}
      />
    );
  }

  // Affichage principal avec bouton retour global
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box>
        <Box sx={{ mt: 4, mb: 2 }}>
          <Button variant="outlined" onClick={handleBack}>
            ← Retour
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 2, mb: 2, ml: isMobile ? 0 : 8 }}>
          <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : undefined }}>Consistance : {selectedConsistency}</Typography>
          <FormControl sx={{ minWidth: 220 }} fullWidth={isMobile}>
            <InputLabel id="vehicle-select-label-main">Véhicule</InputLabel>
            <Select
              labelId="vehicle-select-label-main"
              value={selectedVehicle ? String((selectedVehicle as Vehicle).id) : ''}
              label="Véhicule"
              onChange={(e: SelectChangeEvent<string>) => {
                const veh = VEHICLES.find((v) => v.id === Number(e.target.value));
                if (veh) setSelectedVehicle(veh);
              }}
            >
              {VEHICLES.map((veh) => (
                <MenuItem key={veh.id} value={String(veh.id)}>{veh.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedConsistency !== 'IS710' && (
            <IconButton color="error" onClick={() => handleDeleteConsistency(selectedConsistency)} sx={{ alignSelf: isMobile ? 'flex-end' : 'center' }}>
              <DeleteIcon />
            </IconButton>
          )}
          <Button variant="outlined" sx={{ mt: isMobile ? 1 : 0 }} fullWidth={isMobile} onClick={() => setShowAddSystemForm(v => !v)}>
            Ajouter un système
          </Button>
        </Box>
        {showAddSystemForm && (
          <Box sx={{ maxWidth: 400, mx: 'auto', mb: 3, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Ajouter un système</Typography>
            <TextField
              label="Nom du système"
              value={newSysName}
              onChange={e => setNewSysName(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Nom de l'opération"
                value={newOpName}
                onChange={e => setNewOpName(e.target.value)}
                fullWidth
              />
              <Button variant="outlined" onClick={handleAddSysOp} disabled={!newOpName.trim()}>
                Ajouter opération
              </Button>
            </Box>
            <Box sx={{ mb: 2 }}>
              {newSysOps.map(op => (
                <span key={op.id} style={{ marginRight: 8 }}>{op.name}</span>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={() => { setShowAddSystemForm(false); setNewSysName(''); setNewSysOps([]); setNewOpName(''); }}>Annuler</Button>
              <Button variant="contained" onClick={handleSaveNewSystem} disabled={!newSysName.trim() || newSysOps.length === 0}>
                Ajouter
              </Button>
            </Box>
          </Box>
        )}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{ minHeight: isMobile ? 36 : 48, mb: isMobile ? 1 : 2 }}
        >
          <Tab label={t.history} />
          <Tab label={editingRecord ? t.edit : t.addRecord} />
        </Tabs>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ mt: 4 }}>{error}</Typography>
        ) : (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600, fontSize: isMobile ? '1.1rem' : '1.3rem', mb: isMobile ? 1 : 2 }}>Plan du véhicule {selectedVehicle.name}</Typography>
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
            {selectedConsistency ? (
              <Typography variant="h6" sx={{ mb: 2 }}>Consistance actuelle : {selectedConsistency}</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button variant="contained" color="primary" onClick={() => setSelectedConsistency('Consistance 1')}>
                  Consistance 1
                </Button>
                <Button variant="contained" color="primary" onClick={() => setSelectedConsistency('Consistance 2')}>
                  Consistance 2
                </Button>
                <Button variant="contained" color="primary" onClick={() => setSelectedConsistency('Consistance 3')}>
                  Consistance 3
                </Button>
              </Box>
            )}
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
                        onClick={() => setShowPdf({operationId: selectedOperation, type: 'protocole'})}
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
                        onClick={() => setShowPdf({operationId: selectedOperation, type: 'tracabilite'})}
                        disabled={!selectedOperation}
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
      </Box>
    </LocalizationProvider>
  );
};

export default VehiclePlan; 