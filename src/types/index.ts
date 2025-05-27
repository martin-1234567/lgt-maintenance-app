export interface System {
  id: string;
  name: string;
  operations: Operation[];
}

export interface Operation {
  id: string;
  name: string;
  protocolUrl?: string;
}

export interface Vehicle {
  id: number;
  name: string;
  planImage: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: number;
  systemId: string;
  operationId: string;
  position: { x: number; y: number };
  timestamp: Date;
  comment?: string;
  user?: string;
  status: 'non commencé' | 'en cours' | 'terminé';
} 