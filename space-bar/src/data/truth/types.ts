export type SourceStatus = 'verified' | 'approximate' | 'placeholder';

export interface SourceMetadata {
  document: string;
  location: string;
  retrieved: string;
  status: SourceStatus;
}

export interface Sourced<T> {
  value: T;
  source: SourceMetadata;
}

export const sourced = <T>(value: T, document: string, location: string, status: SourceStatus = 'verified'): Sourced<T> => ({
  value,
  source: { document, location, retrieved: '2026-11-14', status },
});

export type Destination = 'suborbital' | 'leo' | 'lunar-orbit' | 'lunar-surface' | 'mars-transfer';
export type VehicleStatus = 'operational' | 'retired' | 'test-flight';

export interface TruthRocket {
  id: string;
  name: string;
  firstFlightYear: Sourced<number>;
  status: Sourced<VehicleStatus>;
  humanRated: Sourced<boolean>;
  destinations: Sourced<readonly Destination[]>;
  leoPayloadKg: Sourced<number | null>;
  lunarPayloadKg: Sourced<number | null>;
}

export interface TruthMission {
  id: string;
  name: string;
  year: Sourced<number>;
  destination: Sourced<Destination>;
  crewed: Sourced<boolean>;
  minimumPayloadKg: Sourced<number | null>;
  historicalRocketId: Sourced<string>;
}
