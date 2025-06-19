import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import EditablePDFViewer from './EditablePDFViewer';

interface PDFFormViewerProps {
  url: string;
  onSave: (data: Uint8Array | null, newStatus: string) => Promise<void>;
  status: string;
  onStatusChange: (newStatus: string) => Promise<void>;
  saving: boolean;
  onBack: () => void;
  type: string;
}

const PDFFormViewer: React.FC<PDFFormViewerProps> = ({
  url,
  onSave,
  status,
  onStatusChange,
  saving,
  onBack,
  type
}) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
      }
    };

    fetchPdf();

    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [url]);

  // Extraire l'ID du fichier et du dossier depuis l'URL
  const fileId = url ? url.split('/items/')[1]?.split('/')[0] : undefined;
  const folderId = "01UIJT6YLQOURHAQCBSRB2FWB5PX6OZRJG"; // ID du dossier SharePoint

  return (
    <Box>
      {pdfBlobUrl ? (
        <EditablePDFViewer
          url={pdfBlobUrl}
          fileId={fileId}
          folderId={folderId}
          status={status as 'en cours' | 'terminé'}
          onStatusChange={onStatusChange}
          saving={saving}
          onSave={onSave}
          onBack={onBack}
        />
      ) : (
        <Box sx={{ textAlign: 'center', mt: 4 }}>Chargement du PDF...</Box>
      )}
    </Box>
  );
};

export default PDFFormViewer; 