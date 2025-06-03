import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { Box, TextField, Button, Typography, CircularProgress, Paper } from '@mui/material';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { MaintenanceService } from '../services/maintenanceService';
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.js?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFFormViewerProps {
  url: string;
  fileId: string;
  onSave: (data: Uint8Array | null, newStatus: string) => Promise<void>;
  status: string;
  onStatusChange: (newStatus: string) => Promise<void>;
  saving: boolean;
  onBack: () => void;
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
  onBack
}) => {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPdf, setSavingPdf] = useState(false);
  const [currentField, setCurrentField] = useState<FormField | null>(null);

  useEffect(() => {
    loadPDF();
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [url]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Extraire les champs de formulaire
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      const extractedFields: FormField[] = fields.map(field => {
        const name = field.getName() || '';
        const value = typeof (field as PDFTextField).getText === 'function'
          ? (field as PDFTextField).getText() || ''
          : '';
        return { name, value };
      });

      // Mettre à jour le PDF avec les valeurs des champs
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const newUrl = URL.createObjectURL(blob);
      setPdfData(newUrl);
      setFormFields(extractedFields);
    } catch (error) {
      console.error('Erreur lors du chargement du PDF:', error);
      setPdfData(null);
    } finally {
      setLoading(false);
    }
  };

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

  if (!pdfData) {
    return (
      <Box>
        <Typography color="error">Impossible de charger le PDF ou le PDF ne contient pas de champs de formulaire éditables.</Typography>
        <Button onClick={onBack}>Retour</Button>
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