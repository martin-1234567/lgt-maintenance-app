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
  }

  private async getHeaders() {
    if (!this.accessToken) {
      throw new Error('Token d\'accès non disponible');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
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
} 