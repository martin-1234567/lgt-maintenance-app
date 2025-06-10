import React from 'react';
import { PDFDocument, rgb } from 'pdf-lib';

interface EditablePDFViewerProps {
  url: string;
  fileId?: string;
  onSave: (modifiedPdf: Uint8Array | null, newStatus: 'en cours' | 'terminé') => Promise<void>;
  status: 'en cours' | 'terminé';
  onStatusChange: (status: 'en cours' | 'terminé') => void;
  saving: boolean;
  onBack: () => void;
}

const EditablePDFViewer: React.FC<EditablePDFViewerProps> = ({ url, fileId, onSave, status, onStatusChange, saving, onBack }) => {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [annotation, setAnnotation] = React.useState('');
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
        // (Appelle ici la méthode de ton service pour upload)
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
    </div>
  );
};

export default EditablePDFViewer; 