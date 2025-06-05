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

// Génère une URL d'embed SharePoint à partir de l'ID et du nom du fichier
function getSharePointEmbedUrl(url: string, fileId: string): string {
  // Extrait le nom du fichier depuis l'URL
  let fileName = '';
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    fileName = pathParts[pathParts.length - 1];
  } catch {
    fileName = '';
  }
  // Extrait le site SharePoint
  const match = url.match(/https:\/\/(.*?sharepoint\.com\/sites\/[^/]+)/);
  const siteUrl = match ? match[1] : '';
  if (siteUrl && fileId && fileName) {
    return `https://${siteUrl}/_layouts/15/Doc.aspx?sourcedoc={${fileId}}&file=${encodeURIComponent(fileName)}&action=embedview`;
  }
  return url;
}

const PDFFormViewer: React.FC<PDFFormViewerProps> = ({
  url,
  fileId,
  onSave,
  status,
  onStatusChange,
  saving,
  onBack,
  type
}) => {
  // Si c'est un PDF SharePoint, on génère l'URL d'embed
  const isSharePoint = url.includes('sharepoint.com');
  const embedUrl = isSharePoint ? getSharePointEmbedUrl(url, fileId) : url;

  return (
    <Box>
      <iframe
        src={embedUrl}
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