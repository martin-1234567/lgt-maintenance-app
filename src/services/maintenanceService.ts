import { MaintenanceRecord } from '../types/index';
import axios from 'axios';

const SHAREPOINT_SITE_ID = 'arlingtonfleetfrance.sharepoint.com,3d42766f-7bce-4b8e-92e0-70272ae2b95e,cfa621f3-5013-433c-9d14-3c519f11bb8d';
const SHAREPOINT_DRIVE_ID = 'b!b3ZCPc57jkuS4HAnKuK5XvMhps8TUDxDnRQ8UZ8Ru426aMo8mBCBTrOSBU5EbQE4';
const MAINTENANCE_FOLDER_ID = '01UIJT6YJKMFDSJS4PPJDKVHBTW3MXZ5DO';

interface SharePointFile {
  name: string;
  id: string;
  '@microsoft.graph.downloadUrl': string;
}

interface SharePointResponse {
  value: SharePointFile[];
}

interface CopyFileResponse {
  id: string;
  name: string;
  '@microsoft.graph.downloadUrl': string;
}

interface SharePointFileInfo {
  name: string;
  id: string;
  '@microsoft.graph.downloadUrl': string;
}

interface CopyStatusResponse {
  status: 'inProgress' | 'completed' | 'failed';
  resource?: CopyFileResponse;
}

export class MaintenanceService {
  private static instance: MaintenanceService;
  private accessToken: string | null = null;

  private constructor() {}

  public static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
    console.log('[DEBUG] AccessToken utilisé pour SharePoint:', token);
  }

  private async getHeaders(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Token d\'accès non disponible. Veuillez vous reconnecter.');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json'
    };
  }

  public async getMaintenanceRecords(consistencyId: string, vehicleId: number): Promise<MaintenanceRecord[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get<SharePointResponse>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}/children`,
        { headers }
      );

      const recordsFile = response.data.value.find((file: SharePointFile) => 
        file.name === `maintenance-records-${consistencyId}-${vehicleId}.json`
      );

      if (!recordsFile) {
        return [];
      }

      const fileContent = await axios.get<MaintenanceRecord[]>(recordsFile['@microsoft.graph.downloadUrl'], { headers });
      return fileContent.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des enregistrements:', error);
      return [];
    }
  }

  public async saveMaintenanceRecords(consistencyId: string, vehicleId: number, records: MaintenanceRecord[]): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const fileName = `maintenance-records-${consistencyId}-${vehicleId}.json`;
      
      // Vérifier si le fichier existe déjà
      const response = await axios.get<SharePointResponse>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}/children`,
        { headers }
      );

      const existingFile = response.data.value.find((file: SharePointFile) => file.name === fileName);

      if (existingFile) {
        // Mettre à jour le fichier existant
        await axios.put(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${existingFile.id}/content`,
          JSON.stringify(records),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      } else {
        // Créer un nouveau fichier
        await axios.put(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}:/${fileName}:/content`,
          JSON.stringify(records),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error: any) {
      let message = 'Erreur lors de la sauvegarde des enregistrements';
      if (error.response && error.response.data && error.response.data.error) {
        message += ` : ${error.response.data.error.message}`;
      }
      console.error(message, error);
      throw new Error(message);
    }
  }

  // Ajout gestion centralisée des consistances
  public async getConsistencies(): Promise<string[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get<SharePointResponse>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}/children`,
        { headers }
      );
      const file = response.data.value.find((file: SharePointFile) => file.name === 'consistencies.json');
      if (!file) return ['IS710']; // Valeur par défaut si le fichier n'existe pas
      const fileContent = await axios.get<string[]>(file['@microsoft.graph.downloadUrl'], { headers });
      return fileContent.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des consistances:', error);
      return ['IS710'];
    }
  }

  public async saveConsistencies(consistencies: string[]): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const fileName = 'consistencies.json';
      // Vérifier si le fichier existe déjà
      const response = await axios.get<SharePointResponse>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}/children`,
        { headers }
      );
      const existingFile = response.data.value.find((file: SharePointFile) => file.name === fileName);
      if (existingFile) {
        await axios.put(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${existingFile.id}/content`,
          JSON.stringify(consistencies),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      } else {
        await axios.put(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${MAINTENANCE_FOLDER_ID}:/${fileName}:/content`,
          JSON.stringify(consistencies),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des consistances:', error);
      throw new Error('Erreur lors de la sauvegarde des consistances');
    }
  }

  public async copyFile(sourceFileId: string, destinationFolderId: string, newFileName: string): Promise<CopyFileResponse> {
    try {
      const headers = await this.getHeaders();
      const url = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${sourceFileId}/copy`;
      console.log('[DEBUG] URL appelée pour la copie:', url);
      const copyRequestBody = {
        parentReference: {
          driveId: SHAREPOINT_DRIVE_ID,
          id: destinationFolderId
        },
        name: newFileName
      };
      console.log('[DEBUG] Corps de la requête copyFile:', copyRequestBody);
      console.log('[DEBUG] Headers envoyés pour la copie:', headers);
      await axios.post(
        url,
        copyRequestBody,
        { 
          headers: { 
            ...headers,
            'Content-Type': 'application/json',
            'Prefer': 'respond-async'
          }
        }
      );
      // Attendre 3 secondes (la copie est asynchrone)
      await new Promise(resolve => setTimeout(resolve, 3000));
      // Relister les fichiers du dossier pour retrouver la copie
      const listUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${destinationFolderId}/children`;
      const listResponse = await axios.get<SharePointResponse>(listUrl, { headers });
      const copiedFile = (listResponse.data.value as any[]).find(f => f.name === newFileName);
      if (!copiedFile) {
        throw new Error('La copie du fichier a échoué (fichier non trouvé après délai)');
      }
      return copiedFile;
    } catch (error: any) {
      let message = 'Erreur lors de la copie du fichier';
      if (error.response && error.response.data && error.response.data.error) {
        message += ` : ${error.response.data.error.message}`;
      }
      console.error(message, error);
      throw new Error(message);
    }
  }

  public async updatePdfFile(fileId: string, pdfData: Uint8Array): Promise<void> {
    try {
      console.log('Vérification du token d\'accès...');
      const headers = await this.getHeaders();
      
      console.log('Envoi de la requête de mise à jour du PDF...');
      const response = await axios.put(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${fileId}/content`,
        pdfData,
        {
          headers: {
            ...headers,
            'Content-Type': 'application/pdf'
          }
        }
      );
      
      console.log('Réponse de SharePoint:', response.status);
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Erreur détaillée lors de la mise à jour du PDF:', error);
      
      if (error.response) {
        // Erreur de réponse du serveur
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`Erreur SharePoint (${error.response.status}): ${errorMessage}`);
      } else if (error.request) {
        // Pas de réponse reçue
        throw new Error('Pas de réponse du serveur SharePoint. Vérifiez votre connexion internet.');
      } else {
        // Erreur lors de la configuration de la requête
        throw new Error(`Erreur lors de la mise à jour du PDF: ${error.message}`);
      }
    }
  }

  public async createNewPdfVersion(fileId: string, pdfData: Uint8Array, folderId: string): Promise<{ newFileId: string, newDownloadUrl: string }> {
    try {
      console.log('Création d\'une nouvelle version du PDF...');
      const headers = await this.getHeaders();
      
      // 1. Récupérer les informations du fichier original
      const fileInfoResponse = await axios.get<SharePointFileInfo>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${fileId}`,
        { headers }
      );
      
      const originalFileName = fileInfoResponse.data.name;
      const baseFileName = originalFileName.replace('.pdf', '');
      
      // 2. Générer un nouveau nom de fichier avec timestamp
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const newFileName = `${baseFileName}-${dateStr}.pdf`;
      
      console.log('Nouveau nom de fichier:', newFileName);
      
      // 3. Créer le nouveau fichier avec les données modifiées
      const createResponse = await axios.put<SharePointFileInfo>(
        `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${folderId}:/${newFileName}:/content`,
        pdfData,
        {
          headers: {
            ...headers,
            'Content-Type': 'application/pdf'
          }
        }
      );
      
      console.log('Nouveau fichier créé avec succès');
      
      // 4. Supprimer l'ancien fichier
      try {
        await axios.delete(
          `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${fileId}`,
          { headers }
        );
        console.log('Ancien fichier supprimé avec succès');
      } catch (deleteError) {
        console.warn('Impossible de supprimer l\'ancien fichier:', deleteError);
        // On continue même si la suppression échoue
      }
      
      return {
        newFileId: createResponse.data.id,
        newDownloadUrl: createResponse.data['@microsoft.graph.downloadUrl']
      };
      
    } catch (error: any) {
      console.error('Erreur lors de la création de la nouvelle version du PDF:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`Erreur SharePoint (${error.response.status}): ${errorMessage}`);
      } else if (error.request) {
        throw new Error('Pas de réponse du serveur SharePoint. Vérifiez votre connexion internet.');
      } else {
        throw new Error(`Erreur lors de la création de la nouvelle version: ${error.message}`);
      }
    }
  }
} 