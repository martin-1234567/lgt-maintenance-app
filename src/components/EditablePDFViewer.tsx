import React from 'react';
import { PDFDocument, rgb, PDFTextField } from 'pdf-lib';

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
  const [formFields, setFormFields] = React.useState<{ name: string, value: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingPdf, setSavingPdf] = React.useState(false);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocument | null>(null);

  // Charger le PDF et extraire les champs de formulaire
  React.useEffect(() => {
    (async () => {
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
    })();
  }, [url]);

  // Mettre à jour la valeur d'un champ dans le PDF et dans le state
  const handleFieldChange = async (name: string, value: string) => {
    if (!pdfDoc) return;
    const form = pdfDoc.getForm();
    const field = form.getTextField(name);
    field.setText(value);
    setFormFields(fields => fields.map(f => f.name === name ? { ...f, value } : f));
    setPdfData(new Uint8Array(await pdfDoc.save()));
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