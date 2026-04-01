export class InjectionToken<T = any> {
  readonly __brand!: T;
  constructor(public description: string) {}
}
