import React from 'react';
import { PDFDocument, rgb, PDFTextField } from 'pdf-lib';
import { MaintenanceService } from '../services/maintenanceService';
import { Button, Snackbar, Alert } from '@mui/material';

interface EditablePDFViewerProps {
  url: string;
  fileId?: string;
  folderId?: string;
  onSave: (modifiedPdf: Uint8Array | null, newStatus: 'en cours' | 'terminé') => Promise<void>;
  status: 'en cours' | 'terminé';
  onStatusChange: (status: 'en cours' | 'terminé') => void;
  saving: boolean;
  onBack: () => void;
}

const EditablePDFViewer: React.FC<EditablePDFViewerProps> = ({ url, fileId, folderId, onSave, status, onStatusChange, saving, onBack }) => {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [formFields, setFormFields] = React.useState<{ name: string, value: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingPdf, setSavingPdf] = React.useState(false);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocument | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [lastSavedTime, setLastSavedTime] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const autoSaveInterval = React.useRef<NodeJS.Timeout | null>(null);

  // Charger le PDF et extraire les champs de formulaire
  React.useEffect(() => {
    (async () => {
      try {
        const arrayBuffer = await fetch(url).then(res => res.arrayBuffer());
        const doc = await PDFDocument.load(arrayBuffer);
        setPdfDoc(doc);
        const form = doc.getForm();
        const fields = form.getFields();
        const fieldData = fields.map(f => {
          const name = f.getName();
          let value = '';
          if (f instanceof PDFTextField) {
            value = f.getText() || '';
          }
          return { name, value };
        });
        setFormFields(fieldData);
        setPdfData(new Uint8Array(await doc.save()));
        setLastSavedTime(new Date());
      } catch (err) {
        setError('Erreur lors du chargement du PDF');
        console.error(err);
      }
    })();

    // Nettoyer l'intervalle de sauvegarde automatique lors du démontage
    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [url]);

  // Configurer la sauvegarde automatique
  React.useEffect(() => {
    if (hasUnsavedChanges && fileId) {
      autoSaveInterval.current = setInterval(async () => {
        await handleAutoSave();
      }, 30000); // Sauvegarde automatique toutes les 30 secondes
    }

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [hasUnsavedChanges, fileId]);

  // Mettre à jour la valeur d'un champ dans le PDF et dans le state
  const handleFieldChange = async (name: string, value: string) => {
    if (!pdfDoc) return;
    const form = pdfDoc.getForm();
    const field = form.getTextField(name);
    field.setText(value);
    setFormFields(fields => fields.map(f => f.name === name ? { ...f, value } : f));
    setPdfData(new Uint8Array(await pdfDoc.save()));
    setHasUnsavedChanges(true);
  };

  const handleAutoSave = async () => {
    console.log("entrer dans la fonction handle autosave");
    if (!hasUnsavedChanges || !fileId || !pdfData) return;
    console.log("entrer dans le fonction handle autosave 2");
    
    try {
      const maintenanceService = MaintenanceService.getInstance();
      if (folderId) {
        // Créer une nouvelle version pour la sauvegarde automatique
        await maintenanceService.createNewPdfVersion(fileId, pdfData, folderId);
      } else {
        // Fallback vers l'ancienne méthode si pas de folderId
        await maintenanceService.updatePdfFile(fileId, pdfData);
      }
      setHasUnsavedChanges(false);
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Erreur lors de la sauvegarde automatique:', err);
      setError('Erreur lors de la sauvegarde automatique');
    }
  };

  const handleSave = async (newStatus: 'en cours' | 'terminé') => {
    setSavingPdf(true);
    try {
      console.log('Début de la sauvegarde du PDF...');
      let finalPdfData = pdfData;
      if (pdfDoc) {
        console.log('Sauvegarde du document PDF...');
        finalPdfData = new Uint8Array(await pdfDoc.save());
        setPdfData(finalPdfData);
      }
      if (finalPdfData && fileId) {
        console.log('Création d\'une nouvelle version du fichier sur SharePoint...');
        const maintenanceService = MaintenanceService.getInstance();
        try {
          if (folderId) {
            // Créer une nouvelle version du PDF
            const result = await maintenanceService.createNewPdfVersion(fileId, finalPdfData, folderId);
            console.log('Nouvelle version créée avec succès:', result);
            setHasUnsavedChanges(false);
            setLastSavedTime(new Date());
          } else {
            // Fallback vers l'ancienne méthode si pas de folderId
            await maintenanceService.updatePdfFile(fileId, finalPdfData);
            console.log('Fichier mis à jour avec succès');
            setHasUnsavedChanges(false);
            setLastSavedTime(new Date());
          }
        } catch (error: any) {
          console.error('Erreur détaillée lors de la création de la nouvelle version:', error);
          throw new Error(`Erreur lors de la création de la nouvelle version: ${error.message || error}`);
        }
      } else {
        console.warn('Pas de données PDF ou ID de fichier manquant');
      }
      
      console.log('Mise à jour du statut...');
      await onStatusChange(newStatus);
      
      if (onSave) {
        console.log('Appel de la fonction onSave...');
        await onSave(finalPdfData, newStatus);
      }
      
      console.log('Sauvegarde terminée avec succès');
      onBack();
    } catch (err: any) {
      console.error('Erreur complète lors de la sauvegarde:', err);
      setError(`Erreur lors de la sauvegarde du PDF : ${err.message || err}`);
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '80vh', overflow: 'auto', background: '#222' }}>
      <div style={{ margin: 8, display: 'flex', gap: 8 }}>
        {/* Formulaire dynamique pour les champs texte du PDF */}
        {formFields.length > 0 && (
          <form style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <b>Champs éditables du PDF :</b>
            {formFields.map(f => (
              <div key={f.name} style={{ margin: '8px 0' }}>
                <label style={{ fontWeight: 500 }}>{f.name} : </label>
                <input
                  type="text"
                  value={f.value}
                  onChange={e => handleFieldChange(f.name, e.target.value)}
                  style={{ marginLeft: 8, padding: 4, minWidth: 180 }}
                />
              </div>
            ))}
          </form>
        )}
      </div>
      {pdfData && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '8px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => handleSave('en cours')}
                disabled={savingPdf}
                style={{ marginRight: '8px' }}
              >
                {savingPdf ? 'Sauvegarde...' : 'Sauvegarder en cours'}
              </Button>
              <Button 
                variant="contained" 
                color="success" 
                onClick={() => handleSave('terminé')}
                disabled={savingPdf}
              >
                {savingPdf ? 'Sauvegarde...' : 'Terminer et sauvegarder'}
              </Button>
            </div>
            <div style={{ color: hasUnsavedChanges ? '#f44336' : '#4caf50', fontSize: '0.9rem' }}>
              {hasUnsavedChanges ? 'Modifications non sauvegardées' : 
               lastSavedTime ? `Dernière sauvegarde : ${lastSavedTime.toLocaleTimeString()}` : ''}
            </div>
          </div>
          <iframe
            src={URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }))}
            title="PDF modifiable"
            width="100%"
            height="100%"
            style={{ border: 'none', background: '#fff' }}
          />
        </div>
      )}
      {!pdfData && <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Chargement du PDF…</div>}
      
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default EditablePDFViewer; 