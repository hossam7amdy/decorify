export const Lifetime = {
  SINGLETON: "singleton",
  TRANSIENT: "transient",
  SCOPED: "scoped",
} as const;

export type Lifetime = (typeof Lifetime)[keyof typeof Lifetime];
