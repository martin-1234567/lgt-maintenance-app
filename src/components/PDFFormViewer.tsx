import React from 'react';
import { Box, Button } from '@mui/material';

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

const PDFFormViewer: React.FC<PDFFormViewerProps> = ({
  url,
  onSave,
  status,
  onStatusChange,
  saving,
  onBack,
  type
}) => {
  return (
    <Box>
      <iframe
        src={url}
        title="Aperçu PDF"
        width="100%"
        height="800px"
        style={{ border: 'none' }}
      />
      <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
        <Button variant="outlined" onClick={onBack} disabled={saving}>Retour</Button>
        {type === 'tracabilite' && (
          <>
            <Button
              variant="contained"
              color="primary"
              disabled={saving}
              onClick={async () => {
                if (onStatusChange) await onStatusChange('en cours');
                if (onSave) await onSave(null, 'en cours');
              }}
            >
              Sauvegarder
            </Button>
            {status !== 'terminé' && (
              <Button
                variant="contained"
                color="success"
                disabled={saving}
                onClick={async () => {
                  if (onStatusChange) await onStatusChange('terminé');
                  if (onSave) await onSave(null, 'terminé');
                }}
              >
                Terminer
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default PDFFormViewer; 