import type { Computer } from "@/features/devices/types";
import type { ID } from "@/types/common";
import { MOCK_COMPUTERS } from "@/data/mockComputers";
import { resolve } from "./api";

export function listComputers(): Promise<Computer[]> {
  return resolve(MOCK_COMPUTERS);
}

export function getComputer(id: ID): Promise<Computer | undefined> {
  return resolve(MOCK_COMPUTERS.find((c) => c.id === id));
}
