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
import { pdfjs, Document, Page } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';
import PullToRefresh from 'react-pull-to-refresh';
import { useSwipeable } from 'react-swipeable';
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

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

  const handleStatusChange = async (newStatus: 'en cours' | 'terminé'): Promise<void> => {
    if (type !== 'tracabilite') return;
    setSaving(true);
    try {
      // Mettre à jour le statut dans l'application
      if (setStatus) {
        await setStatus(newStatus);
      }
      // Attendre un peu pour s'assurer que les modifications sont sauvegardées
      await new Promise(resolve => setTimeout(resolve, 1000));
      // (onBack sera appelé par le parent)
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
      } else if (type === 'tracabilite') {
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
            {type === 'tracabilite' && allowStatusChange && (
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
        {!loading && (type === 'tracabilite' || type === 'protocole') && (
          objectUrl ? (
            <EditablePDFViewer
              url={objectUrl}
              status={currentStatus === 'terminé' ? 'terminé' : 'en cours'}
              onStatusChange={async (newStatus) => {
                if (setStatus) {
                  console.log('[DEBUG] setStatus appelé avec', newStatus, 'pour record', { operationCode, type, currentStatus });
                  await setStatus(newStatus);
                }
              }}
              saving={saving}
              onSave={async (_data, _newStatus) => {}}
              onBack={onBack}
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

      // Synchronisation du statut avec la colonne Excel (désactivée pour persistance JSON)
      // for (let i = 0; i < records.length; i++) {
      //   const record = records[i];
      //   const opCode = record.operationId;
      //   const folderPath = '/AFF-Projets/Le Grand Tour/Etude Maintenance/40.DOCUMENTATION/ESSAI OUTILS';
      //   const filesRes = await fetch(
      //     `https://graph.microsoft.com/v1.0/sites/arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d/drive/root:${folderPath}:/children`,
      //     { headers: { Authorization: `Bearer ${response.accessToken}` } }
      //   );
      //   const filesData = await filesRes.json();
      //   let file = (filesData.value as any[]).find((f: any) => f.name === `FT-LGT-${opCode}.xlsx`);
      //   if (!file) {
      //     file = (filesData.value as any[]).find((f: any) => f.name.includes(opCode) && f.name.endsWith('.xlsx'));
      //   }
      //   if (file && file['@microsoft.graph.downloadUrl']) {
      //     try {
      //       const excelBlob = await fetch(file['@microsoft.graph.downloadUrl']);
      //       const arrayBuffer = await excelBlob.arrayBuffer();
      //       const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      //       const firstSheetName = workbook.SheetNames[0];
      //       const worksheet = workbook.Sheets[firstSheetName];
      //       const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | undefined)[][];
      //       const headerRow = excelData[0] as string[];
      //       const statusColIndex = headerRow.findIndex((col) => col && col.toLowerCase().includes('statut'));
      //       let statusValue: 'non commencé' | 'en cours' | 'terminé' = 'non commencé';
      //       if (statusColIndex !== -1 && excelData[1] && typeof excelData[1][statusColIndex] === 'string') {
      //         const cellValue = (excelData[1][statusColIndex] as string).toLowerCase();
      //         if (cellValue.includes('en cours')) statusValue = 'en cours';
      //         else if (cellValue.includes('terminé')) statusValue = 'terminé';
      //       }
      //       records[i].status = statusValue;
      //     } catch (e) {
      //       // Si erreur de lecture Excel, on laisse le statut existant
      //     }
      //   }
      // }
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
        scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
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
      scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
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
        scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
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

  // Modification de la fonction refreshAllRecords pour qu'elle recharge aussi les consistances
  const refreshAllRecords = async () => {
    setLoading(true);
    try {
      // Recharger les consistances depuis SharePoint
      if (accounts && accounts.length > 0) {
        const response = await instance.acquireTokenSilent({
          scopes: ['Files.Read.All', 'Sites.Read.All', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
          account: accounts[0],
        });
        maintenanceService.setAccessToken(response.accessToken);
        
        // 1. Recharger les consistances
        const sharepointConsistencies = await maintenanceService.getConsistencies();
        setConsistencies(sharepointConsistencies);
        
        // 2. Pour chaque consistance, recharger tous les enregistrements
        const newRecordsByConsistency: { [cons: string]: { [vehicleId: number]: MaintenanceRecord[] } } = {};
        
        for (const cons of sharepointConsistencies) {
          newRecordsByConsistency[cons] = {};
          
          for (const vehicle of VEHICLES) {
            // Recharger depuis SharePoint
            const records = await maintenanceService.getMaintenanceRecords(cons, vehicle.id);
            
            // Mettre à jour le state
            newRecordsByConsistency[cons][vehicle.id] = records;
            
            // Mettre à jour le localStorage
            localStorage.setItem(`records-${cons}-${vehicle.id}`, JSON.stringify(records));
          }
        }
        
        // Mettre à jour le state global avec toutes les nouvelles données
        setRecordsByConsistency(newRecordsByConsistency);
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des enregistrements:', err);
      setError('Erreur lors du rafraîchissement des enregistrements');
    } finally {
      setLoading(false);
    }
    return Promise.resolve(); // Pour PullToRefresh
  };

  // Gestion du swipe avec des événements tactiles natifs
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      // Si le swipe horizontal est plus important que le vertical
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
      
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchend', handleTouchEnd);
  };

  // Gestion du pull-to-refresh
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0) {
      refreshAllRecords();
    }
  };

  // Affichage de la modale PDF (protocole ou traçabilité) si demandée
  if (showPdf.operationId && showPdf.type) {
    const record = recordsByConsistency[selectedConsistency]?.[selectedVehicle?.id || 0]?.find(r => r.id === showPdf.recordId);
    return (
      <PdfViewerSharepoint
        operationCode={showPdf.operationId}
        type={showPdf.type}
        onBack={() => setShowPdf({operationId: null, type: undefined})}
        setStatus={record && showPdf.allowStatusChange ? async (status) => {
          if (selectedVehicle && selectedConsistency && record) {
            console.log('[DEBUG] setStatus appelé avec', status, 'pour record', record);
            // Mise à jour du statut dans le state local
            const updatedRecords = recordsByConsistency[selectedConsistency][selectedVehicle.id].map(r => {
              if (r.id === record.id) {
                console.log('[DEBUG] Avant maj statut:', r);
                const updated = { ...r, status };
                console.log('[DEBUG] Après maj statut:', updated);
                return updated;
              }
              return r;
            });
            setRecordsByConsistency(prev => ({
              ...prev,
              [selectedConsistency]: {
                ...prev[selectedConsistency],
                [selectedVehicle.id]: updatedRecords
              }
            }));
            // Sauvegarde dans SharePoint
            await updateRecords(selectedConsistency, selectedVehicle.id, updatedRecords);
            // Fermeture de la modale après la sauvegarde
            setShowPdf({operationId: null, type: undefined});
          }
        } : undefined}
        currentStatus={record?.status || 'non commencé'}
        setTab={setTab}
        systems={systems}
        allowStatusChange={showPdf.allowStatusChange}
        recordId={showPdf.recordId}
      />
    );
  }

  // Affichage principal détaillé : uniquement si consistance ET véhicule sélectionnés
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box 
        onTouchStart={handleTouchStart}
        onScroll={handleScroll}
        sx={{ 
          height: '100vh',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          position: 'relative'
        }}
      >
        <Box sx={{ 
          minHeight: '100vh',
          overflowX: 'hidden'
        }}>
          <Box>
            <Box sx={{ mt: 4, mb: 2 }}>
              <Button variant="outlined" onClick={handleBack}>
                ← Retour
              </Button>
            </Box>
            {/* PAGE D'ACCUEIL : choix consistance + tableau opérations en attente */}
            { !selectedConsistency && (
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
            )}
            {/* Sinon, vue détaillée véhicule/consistance comme actuellement */}
            { selectedConsistency && selectedVehicle && (
              <>
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
                      <Button onClick={() => { resetForm(); setTab(0); }}>Annuler</Button>
                      <Button variant="contained" onClick={handleSaveNewSystem} disabled={!newSysName.trim() || newSysOps.length === 0}>
                        Ajouter
                      </Button>
                    </Box>
                  </Box>
                )}
                {/* Onglets HISTORIQUE et AJOUTER UN ENREGISTREMENT */}
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
                      <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600, fontSize: isMobile ? '1.1rem' : '1.3rem', mb: isMobile ? 1 : 2 }}>
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
  onSave: (modifiedPdf: Uint8Array | null, newStatus: 'en cours' | 'terminé') => Promise<void>;
  status: 'en cours' | 'terminé';
  onStatusChange: (status: 'en cours' | 'terminé') => void;
  saving: boolean;
  onBack: () => void;
}
const EditablePDFViewer: React.FC<EditablePDFViewerProps> = ({ url, onSave, status, onStatusChange, saving, onBack }) => {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [annotation, setAnnotation] = React.useState('');
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

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
    await onStatusChange(newStatus);
    if (onSave) await onSave(null, newStatus);
    // Fermer la fiche après la sauvegarde
    onBack();
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
    </div>
  );
};

export default VehiclePlan; 