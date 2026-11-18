export type EntityId = string;
export type TenantId = string;

export interface ApiHealth {
  status: "ok";
  service: "api";
  timestamp: string;
}
