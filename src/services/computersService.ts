import type { Computer } from "@/features/devices/types";
import * as persistence from "@/store/persistence";
import { resolve } from "./api";

// Local adapter — future: GET /api/computers
export function list(): Promise<Computer[]> {
  return resolve(persistence.load()?.computers ?? []);
}

// Future: POST /api/computers — the store is updated via dispatch; this
// boundary exists so the backend call slots in without component changes.
export function create(computer: Computer): Promise<Computer> {
  return resolve(computer);
}

export function update(computer: Computer): Promise<Computer> {
  return resolve(computer);
}
