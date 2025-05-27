import { System } from '../types';

export const systems: System[] = [
  {
    id: 'system1',
    name: 'Système de freinage',
    operations: [
      { id: 'op1', name: 'Vérification des freins' },
      { id: 'op2', name: 'Remplacement des plaquettes' },
      { id: 'op3', name: 'Ajustement des freins' }
    ]
  },
  {
    id: 'system2',
    name: 'Système électrique',
    operations: [
      { id: 'op4', name: 'Contrôle des batteries' },
      { id: 'op5', name: 'Vérification des connexions' },
      { id: 'op6', name: 'Test des circuits' }
    ]
  },
  {
    id: 'system3',
    name: 'Système pneumatique',
    operations: [
      { id: 'op7', name: 'Contrôle des compresseurs' },
      { id: 'op8', name: 'Vérification des fuites' },
      { id: 'op9', name: 'Test de pression' }
    ]
  },
  {
    id: 'system4',
    name: 'Système de climatisation',
    operations: [
      { id: 'op10', name: 'Nettoyage des filtres' },
      { id: 'op11', name: 'Vérification du fluide' },
      { id: 'op12', name: 'Test de fonctionnement' }
    ]
  }
]; 