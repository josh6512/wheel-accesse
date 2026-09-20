export type CatalogValueType = 'boolean' | 'numeric' | 'select' | 'text';

export interface MobilityTypeSeed {
  id: string;
  code: string;
  displayName: string;
  description: string;
  displayOrder: number;
}

export interface CategorySeed {
  id: string;
  code: string;
  displayName: string;
  description: string;
  displayOrder: number;
}

export interface FeatureOptionSeed {
  id: string;
  code: string;
  displayName: string;
  displayOrder: number;
}

export interface AccessibilityFeatureSeed {
  id: string;
  code: string;
  displayName: string;
  description: string;
  valueType: CatalogValueType;
  unit: string | null;
  options?: readonly FeatureOptionSeed[];
}

export interface CategoryFeatureSeed {
  featureCode: string;
  displayOrder: number;
  isPrimary: boolean;
}

export const mobilityTypes = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    code: 'MANUAL_WHEELCHAIR',
    displayName: 'Manual Wheelchair',
    description: 'Uses a non-powered wheelchair, either independently or with assistance.',
    displayOrder: 10,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    code: 'POWERED_WHEELCHAIR',
    displayName: 'Powered Wheelchair',
    description: 'Uses a powered wheelchair or similar powered mobility device.',
    displayOrder: 20,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    code: 'CRUTCHES',
    displayName: 'Crutches',
    description: 'Uses one or more crutches for mobility support.',
    displayOrder: 30,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    code: 'WALKER_ROLLATOR',
    displayName: 'Walker / Rollator',
    description: 'Uses a walker, rollator, or similar walking frame.',
    displayOrder: 40,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    code: 'WALKING_AID_LIMITED_WALKING',
    displayName: 'Walking Aid / Limited Walking',
    description: 'Uses another walking aid or benefits from shorter, less demanding routes.',
    displayOrder: 50,
  },
] as const satisfies readonly MobilityTypeSeed[];

export const categories = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'HOTEL',
    displayName: 'Hotel',
    description: 'Hotels and other short-stay accommodation.',
    displayOrder: 10,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    code: 'RESTAURANT',
    displayName: 'Restaurant',
    description: 'Restaurants and other sit-down dining venues.',
    displayOrder: 20,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    code: 'PARK',
    displayName: 'Park',
    description: 'Public parks, gardens, and outdoor recreation areas.',
    displayOrder: 30,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    code: 'ATTRACTION',
    displayName: 'Attraction',
    description: 'Visitor attractions, museums, and cultural venues.',
    displayOrder: 40,
  },
] as const satisfies readonly CategorySeed[];

export const accessibilityFeatures = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'STEP_FREE_ENTRANCE',
    displayName: 'Step-free entrance',
    description: 'A main or clearly marked alternative entrance can be reached without steps.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    code: 'ACCESSIBLE_TOILET',
    displayName: 'Accessible toilet',
    description: 'An accessible toilet is available for visitors or guests.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    code: 'ACCESSIBLE_PARKING',
    displayName: 'Accessible parking',
    description: 'Designated accessible parking is available nearby.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    code: 'RAMP_AVAILABLE',
    displayName: 'Ramp available',
    description: 'A permanent or safely deployable ramp is available where needed.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    code: 'ELEVATOR',
    displayName: 'Elevator',
    description: 'An elevator provides access between public floors where needed.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    code: 'GENERAL_MANEUVERING_SPACE',
    displayName: 'Space to maneuver',
    description: 'Main visitor areas provide enough clear space to turn and navigate.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    code: 'ROLL_IN_SHOWER',
    displayName: 'Roll-in shower',
    description: 'A shower can be entered without stepping over a raised threshold.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    code: 'SHOWER_SEAT',
    displayName: 'Shower seat',
    description: 'A secure built-in or portable shower seat is available.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000009',
    code: 'SHOWER_GRAB_BARS',
    displayName: 'Shower grab bars',
    description: 'Secure grab bars are installed in the shower area.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000010',
    code: 'ROOM_MANEUVERING_SPACE',
    displayName: 'Space to maneuver in the room',
    description: 'The guest room has clear space to turn and move around furniture.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000011',
    code: 'BED_HEIGHT',
    displayName: 'Bed height',
    description: 'Height from the floor to the top of the mattress.',
    valueType: 'numeric',
    unit: 'cm',
  },
  {
    id: '30000000-0000-4000-8000-000000000012',
    code: 'BEDSIDE_TRANSFER_SPACE',
    displayName: 'Transfer space beside the bed',
    description: 'Clear floor space is available beside at least one side of the bed.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000013',
    code: 'ADEQUATE_TABLE_SPACING',
    displayName: 'Space between tables',
    description: 'Routes between dining tables provide practical clearance for mobility devices.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000014',
    code: 'WHEELCHAIR_COMPATIBLE_SEATING',
    displayName: 'Wheelchair-friendly table seating',
    description: 'At least one table offers usable knee space and a wheelchair seating position.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000015',
    code: 'ACCESSIBLE_DINING_ROUTE',
    displayName: 'Accessible route through the dining area',
    description:
      'A continuous accessible route connects the entrance, seating, and key facilities.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000016',
    code: 'ACCESSIBLE_PATH',
    displayName: 'Accessible path',
    description: 'At least one path is suitable for visitors using mobility devices.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000017',
    code: 'REST_SEATING_AREAS',
    displayName: 'Rest or seating areas',
    description: 'Seating or rest points are available along the visitor route.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000018',
    code: 'ACCESSIBLE_PRIMARY_ROUTE',
    displayName: 'Accessible route through primary areas',
    description: 'A continuous accessible route reaches the main publicly visited areas.',
    valueType: 'boolean',
    unit: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000019',
    code: 'PATH_SURFACE',
    displayName: 'Path surface',
    description: 'The primary accessible route uses this surface.',
    valueType: 'select',
    unit: null,
    options: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        code: 'PAVED',
        displayName: 'Paved',
        displayOrder: 10,
      },
      {
        id: '40000000-0000-4000-8000-000000000002',
        code: 'ASPHALT',
        displayName: 'Asphalt',
        displayOrder: 20,
      },
      {
        id: '40000000-0000-4000-8000-000000000003',
        code: 'GRAVEL',
        displayName: 'Gravel',
        displayOrder: 30,
      },
      {
        id: '40000000-0000-4000-8000-000000000004',
        code: 'GRASS',
        displayName: 'Grass',
        displayOrder: 40,
      },
      {
        id: '40000000-0000-4000-8000-000000000005',
        code: 'DIRT_NATURAL_SURFACE',
        displayName: 'Dirt / Natural Surface',
        displayOrder: 50,
      },
    ],
  },
] as const satisfies readonly AccessibilityFeatureSeed[];

export const categoryFeatures = {
  HOTEL: [
    { featureCode: 'STEP_FREE_ENTRANCE', displayOrder: 10, isPrimary: true },
    { featureCode: 'ACCESSIBLE_TOILET', displayOrder: 20, isPrimary: true },
    { featureCode: 'ACCESSIBLE_PARKING', displayOrder: 30, isPrimary: true },
    { featureCode: 'RAMP_AVAILABLE', displayOrder: 40, isPrimary: false },
    { featureCode: 'ELEVATOR', displayOrder: 50, isPrimary: true },
    { featureCode: 'GENERAL_MANEUVERING_SPACE', displayOrder: 60, isPrimary: false },
    { featureCode: 'ROOM_MANEUVERING_SPACE', displayOrder: 70, isPrimary: true },
    { featureCode: 'ROLL_IN_SHOWER', displayOrder: 80, isPrimary: true },
    { featureCode: 'SHOWER_SEAT', displayOrder: 90, isPrimary: false },
    { featureCode: 'SHOWER_GRAB_BARS', displayOrder: 100, isPrimary: false },
    { featureCode: 'BED_HEIGHT', displayOrder: 110, isPrimary: false },
    { featureCode: 'BEDSIDE_TRANSFER_SPACE', displayOrder: 120, isPrimary: true },
  ],
  RESTAURANT: [
    { featureCode: 'STEP_FREE_ENTRANCE', displayOrder: 10, isPrimary: true },
    { featureCode: 'ACCESSIBLE_TOILET', displayOrder: 20, isPrimary: true },
    { featureCode: 'ACCESSIBLE_PARKING', displayOrder: 30, isPrimary: false },
    { featureCode: 'RAMP_AVAILABLE', displayOrder: 40, isPrimary: false },
    { featureCode: 'GENERAL_MANEUVERING_SPACE', displayOrder: 50, isPrimary: true },
    { featureCode: 'ADEQUATE_TABLE_SPACING', displayOrder: 60, isPrimary: true },
    { featureCode: 'WHEELCHAIR_COMPATIBLE_SEATING', displayOrder: 70, isPrimary: true },
    { featureCode: 'ACCESSIBLE_DINING_ROUTE', displayOrder: 80, isPrimary: true },
  ],
  PARK: [
    { featureCode: 'STEP_FREE_ENTRANCE', displayOrder: 10, isPrimary: true },
    { featureCode: 'ACCESSIBLE_TOILET', displayOrder: 20, isPrimary: true },
    { featureCode: 'ACCESSIBLE_PARKING', displayOrder: 30, isPrimary: true },
    { featureCode: 'RAMP_AVAILABLE', displayOrder: 40, isPrimary: false },
    { featureCode: 'ACCESSIBLE_PATH', displayOrder: 50, isPrimary: true },
    { featureCode: 'REST_SEATING_AREAS', displayOrder: 60, isPrimary: true },
    { featureCode: 'ACCESSIBLE_PRIMARY_ROUTE', displayOrder: 70, isPrimary: true },
    { featureCode: 'PATH_SURFACE', displayOrder: 80, isPrimary: true },
  ],
  ATTRACTION: [
    { featureCode: 'STEP_FREE_ENTRANCE', displayOrder: 10, isPrimary: true },
    { featureCode: 'ACCESSIBLE_TOILET', displayOrder: 20, isPrimary: true },
    { featureCode: 'ACCESSIBLE_PARKING', displayOrder: 30, isPrimary: false },
    { featureCode: 'RAMP_AVAILABLE', displayOrder: 40, isPrimary: false },
    { featureCode: 'ELEVATOR', displayOrder: 50, isPrimary: true },
    { featureCode: 'GENERAL_MANEUVERING_SPACE', displayOrder: 60, isPrimary: false },
    { featureCode: 'ACCESSIBLE_PRIMARY_ROUTE', displayOrder: 70, isPrimary: true },
    { featureCode: 'REST_SEATING_AREAS', displayOrder: 80, isPrimary: true },
  ],
} as const satisfies Record<(typeof categories)[number]['code'], readonly CategoryFeatureSeed[]>;
