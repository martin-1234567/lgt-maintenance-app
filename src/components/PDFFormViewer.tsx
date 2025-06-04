import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { Box, TextField, Button, Typography, CircularProgress, Paper } from '@mui/material';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { MaintenanceService } from '../services/maintenanceService';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?worker';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.js`;

interface PDFFormViewerProps {
  url: string;
  fileId: string;
  onSave: (data: Uint8Array | null, newStatus: string) => Promise<void>;
  status: string;
  onStatusChange: (newStatus: string) => Promise<void>;
  saving: boolean;
  onBack: () => void;
  accessToken?: string;
  type: string;
}

interface FormField {
  name: string;
  value: string;
}

const PDFFormViewer: React.FC<PDFFormViewerProps> = ({
  url,
  fileId,
  onSave,
  status,
  onStatusChange,
  saving,
  onBack,
  accessToken,
  type
}) => {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPdf, setSavingPdf] = useState(false);
  const [currentField, setCurrentField] = useState<FormField | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      setLoading(true);
      setError(null);
      try {
        let arrayBuffer: ArrayBuffer;
        if (accessToken && url.startsWith('https://arlingtonfleetfrance.sharepoint.com')) {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!response.ok) throw new Error('Erreur lors du téléchargement du PDF SharePoint');
          arrayBuffer = await response.arrayBuffer();
        } else {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Erreur lors du téléchargement du PDF');
          arrayBuffer = await response.arrayBuffer();
        }
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const extractedFields: FormField[] = fields.map(field => {
          const name = field.getName() || '';
          const value = typeof (field as PDFTextField).getText === 'function'
            ? (field as PDFTextField).getText() || ''
            : '';
          return { name, value };
        });
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const newUrl = URL.createObjectURL(blob);
        setPdfData(newUrl);
        setFormFields(extractedFields);
      } catch (err: any) {
        setError('Impossible de charger le PDF (accès SharePoint ou format invalide).');
        setPdfData(null);
      } finally {
        setLoading(false);
      }
    };
    loadPDF();
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [url, accessToken]);

  const handleFieldChange = async (name: string, value: string) => {
    try {
      if (!pdfData) return;

      const response = await fetch(pdfData);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const form = pdfDoc.getForm();
      const field = form.getField(name);
      if (field instanceof PDFTextField) {
        field.setText(value);
      }

      const updatedBytes = await pdfDoc.save();
      const blob = new Blob([updatedBytes], { type: 'application/pdf' });
      const newUrl = URL.createObjectURL(blob);
      
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
      
      setPdfData(newUrl);
      setFormFields(prev => prev.map(f => f.name === name ? { ...f, value } : f));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du champ:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSavingPdf(true);
      if (!pdfData) return;

      const response = await fetch(pdfData);
      const arrayBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      await onSave(pdfBytes, status);
      await onStatusChange(status);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSavingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography color="error">{error}</Typography>
        <Button onClick={onBack}>Retour</Button>
      </Box>
    );
  }

  if (!pdfData) {
    return (
      <Box>
        <Typography color="error">Impossible de charger le PDF ou le PDF ne contient pas de champs de formulaire éditables.</Typography>
        <Button onClick={onBack}>Retour</Button>
      </Box>
    );
  }

  if (type === 'tracabilite') {
    return (
      <Box>
        <iframe
          src={url}
          title="Fiche de traçabilité"
          width="100%"
          height="800px"
          style={{ border: 'none' }}
        />
        <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
          <Button variant="outlined" onClick={onBack} disabled={saving}>Retour</Button>
          <Button
            variant="contained"
            component="label"
            color="primary"
            disabled={saving}
          >
            Uploader le PDF modifié
            <input
              type="file"
              accept="application/pdf"
              hidden
              onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  const arrayBuffer = await file.arrayBuffer();
                  await onSave(new Uint8Array(arrayBuffer), status);
                  alert('PDF modifié sauvegardé sur SharePoint !');
                }
              }}
            />
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={2}>
        <Typography variant="h6" gutterBottom>
          Champs du formulaire
        </Typography>
        {formFields.map((field) => (
          <TextField
            key={field.name}
            label={field.name}
            value={field.value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
          />
        ))}
      </Box>

      <Box mb={2}>
        <Paper elevation={3} sx={{ p: 2 }}>
          <Document file={pdfData || url}>
            <Page pageNumber={1} />
          </Document>
        </Paper>
      </Box>

      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          onClick={onBack}
          disabled={savingPdf}
        >
          Retour
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={savingPdf}
        >
          {savingPdf ? <CircularProgress size={24} /> : 'Sauvegarder'}
        </Button>
        {status !== 'terminé' && (
          <Button
            variant="contained"
            color="success"
            onClick={async () => {
              await onStatusChange('terminé');
              await handleSave();
            }}
            disabled={savingPdf}
          >
            Terminer
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default PDFFormViewer; 