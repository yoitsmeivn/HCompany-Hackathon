export class ComputerRegistry {
  private readonly ids = new Set<string>();
  register(id: string): void { this.ids.add(id); }
  has(id: string): boolean { return this.ids.has(id); }
}
